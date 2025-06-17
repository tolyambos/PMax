"use client";

import Link from "next/link";
import { Button } from "@/app/components/ui/button";
import AssetGrid from "@/app/components/assets/asset-grid";
import UploadButton from "@/app/components/assets/upload-button";
import { useRouter } from "next/navigation";
import { useToast } from "@/app/components/ui/use-toast";

export default function AssetsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = () => {
    localStorage.removeItem("mockUser");
    toast({
      title: "Logged out successfully",
    });
    router.push("/");
  };

  return (
    <main className="flex flex-col min-h-screen">
      <div className="flex items-center px-6 h-16 border-b">
        <Link href="/" className="text-xl font-bold">
          PMax
        </Link>
        <div className="flex gap-4 items-center ml-auto">
          <Link href="/">
            <Button variant="outline" size="sm">
              Back to Home
            </Button>
          </Link>
          <UploadButton />
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </div>

      <div className="container flex flex-col flex-1 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Media Library</h1>
        </div>

        <div className="flex mb-6 space-x-2">
          <Button size="sm" variant="secondary">
            All
          </Button>
          <Button size="sm" variant="outline">
            Images
          </Button>
          <Button size="sm" variant="outline">
            Videos
          </Button>
          <Button size="sm" variant="outline">
            Audio
          </Button>
        </div>

        <AssetGrid />
      </div>
    </main>
  );
}
