// Tailwind-aware className combiner. clsx handles conditional classes;
// twMerge dedupes conflicting Tailwind utilities (last one wins).
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
