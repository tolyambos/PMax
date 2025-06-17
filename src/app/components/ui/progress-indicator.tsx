"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressIndicatorProps {
  value: number; // 0-100
  className?: string;
  variant?: "default" | "gradient";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
}

const sizeClasses = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function ProgressIndicator({
  value,
  className,
  variant = "default",
  size = "md",
  showLabel = false,
  label,
}: ProgressIndicatorProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-sm text-muted-foreground">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}

      <div
        className={cn(
          "overflow-hidden relative rounded-full bg-muted",
          sizeClasses[size]
        )}
      >
        <motion.div
          className={cn(
            "h-full rounded-full",
            variant === "gradient" ? "bg-gradient-primary" : "bg-primary"
          )}
          initial={{ width: "0%" }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {variant === "gradient" && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent via-white/20"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ width: "30%" }}
          />
        )}
      </div>
    </div>
  );
}

interface CircularProgressProps {
  value: number; // 0-100
  size?: number; // diameter in pixels
  strokeWidth?: number;
  className?: string;
  variant?: "default" | "gradient";
  showLabel?: boolean;
}

export function CircularProgress({
  value,
  size = 120,
  strokeWidth = 8,
  className,
  variant = "default",
  showLabel = true,
}: CircularProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (clampedValue / 100) * circumference;

  return (
    <div
      className={cn(
        "inline-flex relative justify-center items-center",
        className
      )}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="transparent"
        />

        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={
            variant === "gradient" ? "url(#gradient)" : "hsl(var(--primary))"
          }
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeInOut" }}
        />

        {variant === "gradient" && (
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--ai-primary))" />
              <stop offset="100%" stopColor="hsl(var(--ai-accent))" />
            </linearGradient>
          </defs>
        )}
      </svg>

      {showLabel && (
        <motion.div
          className="flex absolute inset-0 justify-center items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <span className="text-2xl font-bold text-foreground">
            {Math.round(clampedValue)}%
          </span>
        </motion.div>
      )}
    </div>
  );
}

interface StepProgressProps {
  steps: string[];
  currentStep: number; // 0-based index
  className?: string;
  variant?: "default" | "gradient";
}

export function StepProgress({
  steps,
  currentStep,
  className,
  variant = "default",
}: StepProgressProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-center">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center">
            {/* Step indicator */}
            <motion.div
              className={cn(
                "relative flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium",
                index <= currentStep
                  ? variant === "gradient"
                    ? "bg-gradient-primary border-transparent text-white"
                    : "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-muted-foreground text-muted-foreground"
              )}
              initial={{ scale: 0.8 }}
              animate={{ scale: index === currentStep ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {index + 1}
            </motion.div>

            {/* Step connector */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-2 h-0.5 bg-muted relative overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full",
                    variant === "gradient"
                      ? "bg-gradient-primary"
                      : "bg-primary"
                  )}
                  initial={{ width: "0%" }}
                  animate={{ width: index < currentStep ? "100%" : "0%" }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Step labels */}
      <div className="flex justify-between mt-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className={cn(
              "text-xs text-center",
              index <= currentStep ? "text-foreground" : "text-muted-foreground"
            )}
            style={{ width: "80px" }}
          >
            {step}
          </div>
        ))}
      </div>
    </div>
  );
}
