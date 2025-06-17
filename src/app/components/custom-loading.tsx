"use client";

export default function CustomLoading() {
  return (
    <div className="flex justify-center items-center h-screen">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 rounded-full border-t-2 border-b-2 animate-spin border-primary"></div>
        <p className="text-lg font-medium">Loading PMax...</p>
      </div>
    </div>
  );
}
