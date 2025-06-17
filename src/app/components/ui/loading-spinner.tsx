"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "default" | "gradient";
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
};

export function LoadingSpinner({
  size = "md",
  className,
  variant = "default",
}: LoadingSpinnerProps) {
  return (
    <motion.div
      className={cn(
        "inline-block rounded-full border-2 border-solid",
        sizeClasses[size],
        variant === "gradient"
          ? "border-primary border-t-transparent"
          : "border-muted-foreground border-t-transparent",
        className
      )}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear",
      }}
      style={{
        borderTopColor: "transparent",
      }}
    />
  );
}

interface LoadingDotsProps {
  className?: string;
  variant?: "default" | "gradient";
}

export function LoadingDots({
  className,
  variant = "default",
}: LoadingDotsProps) {
  return (
    <div className={cn("flex space-x-1", className)}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn(
            "w-2 h-2 rounded-full",
            variant === "gradient" ? "bg-primary" : "bg-muted-foreground"
          )}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: index * 0.1,
          }}
        />
      ))}
    </div>
  );
}

interface LoadingPulseProps {
  className?: string;
  variant?: "default" | "gradient";
}

export function LoadingPulse({
  className,
  variant = "default",
}: LoadingPulseProps) {
  return (
    <motion.div
      className={cn(
        "w-8 h-8 rounded-full",
        variant === "gradient" ? "bg-gradient-primary" : "bg-muted-foreground",
        className
      )}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.7, 1, 0.7],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}
