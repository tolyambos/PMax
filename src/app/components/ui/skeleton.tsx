"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  animated?: boolean;
}

export function Skeleton({ className, animated = true }: SkeletonProps) {
  const Component = animated ? motion.div : "div";

  return (
    <Component
      className={cn("rounded-md animate-pulse bg-muted", className)}
      {...(animated && {
        animate: {
          opacity: [0.5, 1, 0.5],
        },
        transition: {
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        },
      })}
    />
  );
}

// Pre-built skeleton components for common use cases
export function ProjectCardSkeleton() {
  return (
    <div className="p-6 space-y-4 rounded-xl border bg-card">
      <div className="flex items-center space-x-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-3/4 h-4" />
          <Skeleton className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-32 rounded-lg" />
      <div className="flex justify-between items-center">
        <Skeleton className="w-1/3 h-4" />
        <Skeleton className="w-20 h-8 rounded-md" />
      </div>
    </div>
  );
}

export function VideoTimelineSkeleton() {
  return (
    <div className="p-4 space-y-4 w-full">
      <div className="flex justify-between items-center">
        <Skeleton className="w-32 h-6" />
        <Skeleton className="w-24 h-8 rounded-md" />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center space-x-3">
            <Skeleton className="w-10 h-10 rounded" />
            <Skeleton className="flex-1 h-6" />
            <Skeleton className="w-16 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssetGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-full rounded-lg aspect-square" />
          <Skeleton className="w-3/4 h-3" />
          <Skeleton className="w-1/2 h-3" />
        </div>
      ))}
    </div>
  );
}
