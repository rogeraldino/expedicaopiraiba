"use client";
import { CustomerJourney } from "@/components/customer/customer-journey";
export function ConfirmationOnboarding({reservationId}:{reservationId:string}) { return <CustomerJourney reservationId={reservationId} confirmation/>; }
