#!/usr/bin/env python3
"""Encrypted multi-environment backup; legacy filename and client contract retained."""
import datetime
import fcntl
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

EXCLUDED = {'.git', 'node_modules', '.next', '__pycache__', '.venv', '.pytest_cache', '.codex', '.ssh'}
OUTPUT = Path('/var/backups/vm')
REGISTRY = Path('/etc/vm-backup/environments.json')
RELEASE = Path('/etc/piraiba/release.json')

def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)

def capture(args):
    return subprocess.check_output(args, text=True).strip()

def included(info):
    return None if EXCLUDED.intersection(Path(info.name).parts) else info

def size(path):
    if not path.exists() or path.is_symlink():
        return 0
    if path.is_file():
        return path.stat().st_size
    total = 0
    for directory, dirs, files in os.walk(path, followlinks=False):
        dirs[:] = [d for d in dirs if d not in EXCLUDED and not (Path(directory) / d).is_symlink()]
        for file in files:
            item = Path(directory) / file
            if not item.is_symlink():
                total += item.stat().st_size
    return total

def main():
    os.umask(0o077)
    OUTPUT.mkdir(parents=True, exist_ok=True, mode=0o700)
    with (OUTPUT / '.backup.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Outro backup está em execução; tente novamente depois.')
        create()

def create():
    repo = Path('/root/expedicaopiraiba')
    legacy = dict(name='development', project='expedicaopiraiba', compose_file=str(repo / 'compose.yaml'),
                  compose_override='/tmp/piraiba-local.compose.yaml', database='expedicao_piraiba',
                  user='expedicao_piraiba', source_dir=str(repo))
    environments = json.loads(REGISTRY.read_text()) if REGISTRY.exists() else [legacy]
    if not isinstance(environments, list) or not environments:
        raise SystemExit('Registry deve ser lista não vazia.')
    if any(not re.fullmatch(r'[a-z][a-z0-9_-]{0,63}', e['name']) for e in environments):
        raise SystemExit('Nome inválido no registry.')
    if len({e['name'] for e in environments}) != len(environments):
        raise SystemExit('Nomes duplicados no registry.')
    sources = [(repo, 'repository'), (Path('/root/infra'), 'infra'),
               (Path('/root/.config/expedicaopiraiba'), 'provider-config'),
               (Path('/etc/caddy'), 'caddy-config'), (Path('/etc/piraiba'), 'piraiba-config'),
               (Path('/etc/vm-backup'), 'backup-config'), (Path('/srv/piraiba'), 'deployments'),
               (Path('/tmp/piraiba-local.compose.yaml'), 'local.compose.yaml')]
    for index, env in enumerate(environments):
        source = Path(env['source_dir'])
        if not source.exists():
            raise SystemExit(f"Snapshot ausente: {env['name']}")
        if not any(source == p or p in source.parents for p, _ in sources):
            sources.append((source, f'environment-sources/{index}'))
    release = json.loads(RELEASE.read_text()) if RELEASE.exists() else {}
    db_total = 0
    for env in environments:
        compose = ['docker', 'compose', '-p', env['project'], '-f', env['compose_file']]
        if env.get('env_file'):
            compose += ['--env-file', env['env_file']]
        if env.get('compose_override'):
            compose += ['-f', env['compose_override']]
        container = capture(compose + ['ps', '-q', 'db'])
        if not container or '\n' in container:
            raise SystemExit(f"Banco indisponível ou ambíguo: {env['name']}")
        env['_exec'] = ['docker', 'exec', '-i', container]
        env['_size'] = int(capture(env['_exec'] + ['psql', '-U', env['user'], '-d', env['database'], '-Atc', 'SELECT pg_database_size(current_database())']))
        env['_postgresql_version'] = capture(env['_exec'] + ['psql', '-U', env['user'], '-d', env['database'], '-Atc', 'SHOW server_version'])
        if env['name'] == 'development':
            env['_code'] = dict(git_sha=capture(['git', '-C', env['source_dir'], 'rev-parse', 'HEAD']),
                                source_dirty=bool(capture(['git', '-C', env['source_dir'], 'status', '--porcelain'])))
        else:
            metadata = release.get('environments', {}).get(env['name'], {})
            if metadata.get('source') != env['source_dir']:
                raise SystemExit(f"Release não corresponde ao snapshot: {env['name']}")
            # Environments can advance independently. Preserve legacy manifests
            # while recording the exact sandbox/production snapshot separately.
            env['_code'] = {key: metadata.get(key, release.get(key)) for key in ('release', 'base_git_sha', 'snapshot_sha256', 'source_dirty')}
            if any(value is None for value in env['_code'].values()):
                raise SystemExit(f"Métadados de release incompletos: {env['name']}")
        mounts = json.loads(capture(['docker', 'inspect', container]))[0]['Mounts']
        db_mounts = [m['Source'] for m in mounts if m['Destination'].startswith('/var/lib/postgresql')]
        if not db_mounts:
            raise SystemExit('Volume PostgreSQL não identificado.')
        env['_mounts'] = db_mounts
        db_total += env['_size']
    files_total = sum(size(path) for path, _ in sources)
    required = 3 * db_total + 3 * files_total + 3 * 1024**3
    checked = set()
    for path in [OUTPUT] + [Path(p) for e in environments for p in e['_mounts']]:
        device = path.stat().st_dev
        if device not in checked:
            checked.add(device)
            if shutil.disk_usage(path).free < required:
                raise SystemExit(f'Espaço insuficiente em {path}: necessário {required} bytes; nenhum backup apagado.')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    name = 'piraiba-development-' + stamp + '.tar.gz.age'
    with tempfile.TemporaryDirectory(prefix='.generation-', dir=OUTPUT) as directory:
        staging = Path(directory)
        manifest_envs = []
        for index, env in enumerate(environments):
            dump = staging / f'database-{index}.dump'
            db = env['_exec']
            with dump.open('wb') as stream:
                run(db + ['pg_dump', '-U', env['user'], '-d', env['database'], '-Fc'], stdout=stream)
            test_db = 'backup_check_' + stamp.lower() + '_' + str(index)
            run(db + ['createdb', '-U', env['user'], test_db])
            try:
                with dump.open('rb') as stream:
                    run(db + ['pg_restore', '-U', env['user'], '-d', test_db, '--exit-on-error', '--no-owner'], stdin=stream)
                run(db + ['psql', '-U', env['user'], '-d', test_db, '-v', 'ON_ERROR_STOP=1', '-Atc',
                          'SELECT count(*) FROM django_migrations'], stdout=subprocess.DEVNULL)
            finally:
                run(db + ['dropdb', '-U', env['user'], test_db])
            manifest_envs.append({k: env[k] for k in ('name', 'project', 'database', 'user', 'source_dir')})
            manifest_envs[-1].update(postgresql_version=env['_postgresql_version'], code=env['_code'])
            manifest_envs[-1].update(dump=f'databases/{env["name"]}.dump', database_restore_check='PASS')
        bundle = staging / 'repository.bundle'
        run(['git', '-C', str(repo), 'bundle', 'create', str(bundle), '--all'])
        manifest = dict(schema_version=2, created_utc=stamp, database_restore_check='PASS',
                        environments=manifest_envs, git_sha=capture(['git', '-C', str(repo), 'rev-parse', 'HEAD']),
                        consistency='Each database is individually consistent; no cross-environment atomic snapshot.',
                        excluded=['Docker images', 'Codex credentials', 'SSH private keys', *sorted(EXCLUDED)])
        (staging / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        archive = staging / 'backup.tar.gz'
        with tarfile.open(archive, 'w:gz', compresslevel=3) as tar:
            tar.add(staging / 'manifest.json', arcname='manifest.json')
            tar.add(bundle, arcname='repository.bundle')
            for index, env in enumerate(environments):
                tar.add(staging / f'database-{index}.dump', arcname=f'databases/{env["name"]}.dump')
                if env['name'] == 'development':
                    tar.add(staging / f'database-{index}.dump', arcname='database.dump')
            for source, target in sources:
                if source.exists():
                    tar.add(source, arcname=target, filter=included)
        # Recheck conservative margin before producing encrypted output.
        if shutil.disk_usage(OUTPUT).free < archive.stat().st_size + 3 * 1024**3:
            raise SystemExit('Espaço insuficiente para publicar backup criptografado.')
        encrypted = staging / name
        run(['age', '-R', '/etc/vm-backup/recipient.txt', '-o', str(encrypted), str(archive)])
        with encrypted.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        checksum = staging / (name + '.sha256')
        checksum.write_text(digest + '  ' + name + '\n')
        for path in (encrypted, checksum):
            with path.open('rb') as stream:
                os.fsync(stream.fileno())
            path.replace(OUTPUT / path.name)
        ready = staging / (name + '.ready')
        ready.write_text(digest + '\n')
        with ready.open('rb') as stream:
            os.fsync(stream.fileno())
        ready.replace(OUTPUT / ready.name)
        descriptor = os.open(OUTPUT, os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    final = OUTPUT / name
    print(json.dumps(dict(file=str(final), bytes=final.stat().st_size, database_restore='PASS',
                          encrypted=True, external_copy='PENDING')))

if __name__ == '__main__':
    main()
