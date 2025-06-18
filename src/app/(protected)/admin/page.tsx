"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import MainNavigation from "@/app/components/navigation/main-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Switch } from "@/app/components/ui/switch";
import { Badge } from "@/app/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { toast } from "@/app/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { User, Permission, Role } from "@prisma/client";
import { 
  Loader2, 
  Users, 
  Shield, 
  Settings, 
  Database, 
  Ban, 
  Trash2,
  AlertCircle,
  HardDrive,
  Trash
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog";

type UserWithPermissions = User & {
  permissions: Permission[];
  _count: {
    projects: number;
    assets: number;
  };
};

export default function AdminDashboard() {
  const router = useRouter();
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchCleanupStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (!response.ok) {
        if (response.status === 403) {
          toast({
            title: "Access Denied",
            description: "You need admin privileges to access this page.",
            variant: "destructive",
          });
          router.push("/");
          return;
        }
        throw new Error("Failed to fetch users");
      }
      const data = await response.json();
      setUsers(data.users);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCleanupStats = async () => {
    try {
      const response = await fetch("/api/admin/cleanup");
      if (response.ok) {
        const data = await response.json();
        setCleanupStats(data.stats);
      }
    } catch (error) {
      console.error("Error fetching cleanup stats:", error);
    }
  };

  const runCleanup = async () => {
    setIsCleaningUp(true);
    try {
      const response = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Temporary files cleaned up successfully.",
        });
        fetchCleanupStats(); // Refresh stats
      } else {
        throw new Error(data.details || "Cleanup failed");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Cleanup failed",
        variant: "destructive",
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const updateUser = async (userId: string, updates: any) => {
    setUpdating(userId);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to update user");
      }

      const data = await response.json();
      setUsers(users.map((user) => (user.id === userId ? data.user : user)));

      toast({
        title: "Success",
        description: "User updated successfully.",
      });
    } catch (error) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: "Failed to update user. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleUserAction = async (userId: string, action: 'ban' | 'delete') => {
    setUpdating(userId);
    try {
      const response = await fetch(`/api/admin/users?userId=${userId}&action=${action}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} user`);
      }

      toast({
        title: "Success",
        description: data.message || `User ${action === 'ban' ? 'banned' : 'deleted'} successfully`,
      });

      fetchUsers();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} user`,
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  const formatBytes = (bytes: bigint) => {
    const gb = Number(bytes) / 1073741824;
    return gb >= 1
      ? `${gb.toFixed(2)} GB`
      : `${(Number(bytes) / 1048576).toFixed(2)} MB`;
  };

  const isUserBanned = (user: UserWithPermissions) => {
    const perms = user.permissions[0];
    return perms && 
           !perms.canCreateProjects && 
           !perms.canUploadAssets && 
           perms.maxProjects === 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <div className="container px-4 py-8 mx-auto">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users and their permissions
        </p>
      </div>

      <div className="grid gap-4 mb-8 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
            <p className="text-xs text-muted-foreground">
              {users.filter((u) => u.role === "ADMIN").length} admins
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">
              Total Projects
            </CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.reduce((sum, user) => sum + user._count.projects, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Shield className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter((u) => u.permissions[0]?.canCreateProjects).length}
            </div>
            <p className="text-xs text-muted-foreground">Can create projects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row justify-between items-center pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Banned Users</CardTitle>
            <Ban className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(isUserBanned).length}
            </div>
            <p className="text-xs text-muted-foreground">Restricted access</p>
          </CardContent>
        </Card>
      </div>

      {/* System Maintenance Section */}
      <div className="grid gap-4 mb-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Temporary Files Cleanup
            </CardTitle>
            <CardDescription>
              Monitor and clean up render directories and temporary files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cleanupStats ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Render Directories:</span>
                    <div className="font-semibold">{cleanupStats.renderDirectories}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Size:</span>
                    <div className="font-semibold">{cleanupStats.totalRenderSizeFormatted}</div>
                  </div>
                  {cleanupStats.oldestRenderAge && (
                    <div>
                      <span className="text-muted-foreground">Oldest:</span>
                      <div className="font-semibold">{cleanupStats.oldestRenderAge}</div>
                    </div>
                  )}
                  {cleanupStats.newestRenderAge && (
                    <div>
                      <span className="text-muted-foreground">Newest:</span>
                      <div className="font-semibold">{cleanupStats.newestRenderAge}</div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={runCleanup}
                    disabled={isCleaningUp}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    {isCleaningUp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash className="w-4 h-4" />
                    )}
                    {isCleaningUp ? "Cleaning..." : "Run Cleanup"}
                  </Button>
                  <Button
                    onClick={fetchCleanupStats}
                    variant="ghost"
                    size="sm"
                  >
                    Refresh Stats
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Button onClick={fetchCleanupStats} variant="outline" size="sm">
                  Load Cleanup Stats
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage user roles and permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div 
                key={user.id} 
                className={cn(
                  "border rounded-lg p-4 transition-colors",
                  isUserBanned(user) && "bg-destructive/5 border-destructive/20"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold">
                      {user.name || "Unnamed User"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge
                        variant={
                          user.role === "ADMIN" ? "default" : "secondary"
                        }
                      >
                        {user.role}
                      </Badge>
                      {/* Show banned status */}
                      {isUserBanned(user) && (
                        <Badge variant="destructive">
                          <Ban className="mr-1 w-3 h-3" />
                          BANNED
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {user._count.projects} projects
                      </Badge>
                      <Badge variant="outline">
                        {user._count.assets} assets
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select
                      value={user.role}
                      onValueChange={(value) =>
                        updateUser(user.id, { role: value })
                      }
                      disabled={updating === user.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">User</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Can Create Projects</Label>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={
                          user.permissions[0]?.canCreateProjects || false
                        }
                        onCheckedChange={(checked) =>
                          updateUser(user.id, {
                            permissions: { canCreateProjects: checked },
                          })
                        }
                        disabled={updating === user.id}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Projects</Label>
                    <Input
                      type="number"
                      value={user.permissions[0]?.maxProjects || 10}
                      onChange={(e) =>
                        updateUser(user.id, {
                          permissions: {
                            maxProjects: parseInt(e.target.value),
                          },
                        })
                      }
                      disabled={updating === user.id}
                      min={0}
                      max={1000}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Storage</Label>
                    <Select
                      value={String(
                        user.permissions[0]?.maxAssetStorage || 1073741824
                      )}
                      onValueChange={(value) =>
                        updateUser(user.id, {
                          permissions: { maxAssetStorage: BigInt(value) },
                        })
                      }
                      disabled={updating === user.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1073741824">1 GB</SelectItem>
                        <SelectItem value="5368709120">5 GB</SelectItem>
                        <SelectItem value="10737418240">10 GB</SelectItem>
                        <SelectItem value="53687091200">50 GB</SelectItem>
                        <SelectItem value="107374182400">100 GB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 mt-4 border-t">
                  {isUserBanned(user) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updating === user.id || user.role === "ADMIN"}
                      onClick={() => updateUser(user.id, {
                        permissions: {
                          canCreateProjects: false,
                          canUploadAssets: true,
                          maxProjects: 10,
                          maxAssetStorage: BigInt(1073741824), // 1GB
                        },
                      })}
                    >
                      <Ban className="mr-2 w-4 h-4" />
                      Unban User
                    </Button>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={updating === user.id || user.role === "ADMIN"}
                        >
                          <Ban className="mr-2 w-4 h-4" />
                          Ban User
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ban User</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove all permissions for {user.name || user.email}.
                            They will not be able to create projects or upload assets.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUserAction(user.id, 'ban')}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Ban User
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={updating === user.id || user.role === "ADMIN"}
                      >
                        <Trash2 className="mr-2 w-4 h-4" />
                        Delete User
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p className="flex gap-2 items-center">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            This action cannot be undone!
                          </p>
                          <p>This will permanently delete {user.name || user.email} and all their data including:</p>
                          <ul className="pl-5 space-y-1 list-disc">
                            <li>{user._count.projects} projects</li>
                            <li>{user._count.assets} assets</li>
                            <li>All scenes and animations</li>
                          </ul>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleUserAction(user.id, 'delete')}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {user.role === "ADMIN" && (
                    <p className="ml-auto text-sm text-muted-foreground">
                      Admin users cannot be banned or deleted
                    </p>
                  )}
                </div>

                {updating === user.id && (
                  <div className="flex items-center mt-2 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Updating...
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
