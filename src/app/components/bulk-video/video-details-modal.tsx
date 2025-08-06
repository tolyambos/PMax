"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { useToast } from "@/app/components/ui/use-toast";
import { 
  Download, 
  RefreshCw, 
  Edit, 
  Save,
  X,
  Play,
  Image as ImageIcon,
  Film,
  Sparkles,
  CheckCircle,
  XCircle,
  Loader2,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { S3Image } from "./s3-image";
import { S3Video } from "./s3-video";
import { SceneVersionSelector } from "./scene-version-selector";

interface VideoDetailsModalProps {
  video: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function VideoDetailsModal({
  video,
  isOpen,
  onClose,
  onUpdate,
}: VideoDetailsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [editingScene, setEditingScene] = useState<string | null>(null);
  const [editingAnimationPrompt, setEditingAnimationPrompt] = useState<string | null>(null);
  const [scenePrompts, setScenePrompts] = useState<Record<string, string>>({});
  const [animationPrompts, setAnimationPrompts] = useState<Record<string, string>>({});
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [sceneStatuses, setSceneStatuses] = useState<Record<string, any>>({});
  const [showVersions, setShowVersions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Initialize scene prompts
    const prompts: Record<string, string> = {};
    const animPrompts: Record<string, string> = {};
    video.scenes?.forEach((scene: any) => {
      prompts[scene.id] = scene.prompt;
      if (scene.animationPrompt) {
        animPrompts[scene.id] = scene.animationPrompt;
      }
    });
    setScenePrompts(prompts);
    setAnimationPrompts(animPrompts);
  }, [video]);

  // Poll for scene status updates when regenerating
  useEffect(() => {
    if (!isOpen) return;
    
    const regeneratingScenes = Object.entries(regenerating)
      .filter(([_, isRegen]) => isRegen)
      .map(([sceneId]) => sceneId.replace('anim-', ''));
    
    // Get unique scene IDs
    const uniqueSceneIds = Array.from(new Set(regeneratingScenes));
    
    if (uniqueSceneIds.length === 0) return;
    
    const pollStatuses = async () => {
      for (const sceneId of uniqueSceneIds) {
        try {
          const response = await fetch(`/api/bulk-video/scene/${sceneId}/status`);
          if (response.ok) {
            const status = await response.json();
            setSceneStatuses(prev => ({ ...prev, [sceneId]: status }));
            
            // Check if regeneration is complete
            if (status.status === 'completed' || status.status === 'failed') {
              setRegenerating(prev => ({
                ...prev,
                [sceneId]: false,
                [`anim-${sceneId}`]: false,
              }));
              onUpdate();
            }
          }
        } catch (error) {
          console.error('Error polling status:', error);
        }
      }
    };
    
    const interval = setInterval(pollStatuses, 2000); // Poll every 2 seconds
    pollStatuses(); // Initial poll
    
    return () => clearInterval(interval);
  }, [regenerating, isOpen, onUpdate]);

  const handleRegenerateScene = async (sceneId: string) => {
    setRegenerating({ ...regenerating, [sceneId]: true });
    
    try {
      const response = await fetch(`/api/bulk-video/video/${video.id}/regenerate-scene`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sceneId,
          newPrompt: editingScene === sceneId ? scenePrompts[sceneId] : undefined
        }),
      });

      if (!response.ok) throw new Error("Failed to regenerate scene");
      
      toast({
        title: "Scene regeneration started",
        description: "The scene is being regenerated in the background",
      });
      
      setEditingScene(null);
      // Status polling will handle the update
    } catch (error) {
      toast({
        title: "Regeneration failed",
        description: "Failed to regenerate scene",
        variant: "destructive",
      });
    } finally {
      setRegenerating({ ...regenerating, [sceneId]: false });
    }
  };

  const handleRegenerateAnimation = async (sceneId: string, provider?: string) => {
    setRegenerating({ ...regenerating, [`anim-${sceneId}`]: true });
    
    try {
      const response = await fetch(`/api/bulk-video/video/${video.id}/regenerate-animation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          sceneId, 
          animationProvider: provider,
          animationPrompt: editingAnimationPrompt === sceneId ? animationPrompts[sceneId] : undefined
        }),
      });

      if (!response.ok) throw new Error("Failed to regenerate animation");
      
      toast({
        title: "Animation regeneration started",
        description: "The animation is being regenerated in the background",
      });
      
      setEditingAnimationPrompt(null);
      // Status polling will handle the update
    } catch (error) {
      toast({
        title: "Regeneration failed",
        description: "Failed to regenerate animation",
        variant: "destructive",
      });
    } finally {
      setRegenerating({ ...regenerating, [`anim-${sceneId}`]: false });
    }
  };

  const handleRenderVideo = async (format?: string) => {
    try {
      const response = await fetch(`/api/bulk-video/video/${video.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });

      if (!response.ok) throw new Error("Failed to render video");
      
      toast({
        title: "Rendering started",
        description: format ? `Rendering ${format} format` : "Rendering all formats",
      });
      
      // Trigger update to refresh parent component
      onUpdate();
      
      // Start checking render status after a short delay
      setTimeout(() => {
        onUpdate();
      }, 2000);
    } catch (error) {
      toast({
        title: "Render failed",
        description: "Failed to render video",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (renderedVideo: any) => {
    try {
      // Use proxy download endpoint to avoid CORS and access issues
      const proxyUrl = `/api/bulk-video/proxy-download?id=${renderedVideo.id}`;
      
      // Create a temporary anchor element with download attribute
      const a = document.createElement("a");
      a.href = proxyUrl;
      a.download = `video-${video.rowIndex}-${renderedVideo.format.replace("x", "-")}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Download started",
        description: "Your video download has begun",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Failed to download video",
        variant: "destructive",
      });
    }
  };

  const getSceneStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "generating":
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Video #{video.rowIndex}</span>
            <Badge className={cn(
              video.status === "completed" ? "bg-green-100 text-green-800" :
              video.status === "processing" ? "bg-blue-100 text-blue-800" :
              video.status === "failed" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-800"
            )}>
              {video.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div>
              <Label>Text Content</Label>
              <p className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                {video.textContent}
              </p>
            </div>

            {video.productImageUrl && (
              <div>
                <Label>Product Image</Label>
                <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <img
                    src={video.productImageUrl}
                    alt="Product"
                    className="max-h-48 rounded"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Settings</Label>
                <div className="mt-1 space-y-2 text-sm">
                  {video.customFormats?.length > 0 && (
                    <div>Formats: {video.customFormats.join(", ")}</div>
                  )}
                  {video.customDuration && (
                    <div>Duration: {video.customDuration}s</div>
                  )}
                  {video.customSceneCount && (
                    <div>Scenes: {video.customSceneCount}</div>
                  )}
                  {video.customAnimationProvider && (
                    <div>Animation: {video.customAnimationProvider}</div>
                  )}
                  {video.customImageStyle && (
                    <div>Image Style: {video.customImageStyle}</div>
                  )}
                </div>
              </div>

              <div>
                <Label>Statistics</Label>
                <div className="mt-1 space-y-2 text-sm">
                  <div>Created: {new Date(video.createdAt).toLocaleString()}</div>
                  <div>Updated: {new Date(video.updatedAt).toLocaleString()}</div>
                  <div>Scenes: {video.scenes?.length || 0}</div>
                  <div>Rendered: {video.renderedVideos?.filter((r: any) => r.status === "completed").length || 0}</div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="scenes" className="space-y-4">
            {video.scenes?.length > 0 ? (
              video.scenes.map((scene: any, index: number) => (
                <div key={scene.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center gap-2">
                      Scene {index + 1}
                      {getSceneStatusIcon(sceneStatuses[scene.id]?.status || scene.status)}
                    </h4>
                    <div className="flex items-center gap-2">
                      {scene.animationProvider && (
                        <Badge variant="outline">
                          {scene.animationProvider}
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowVersions(prev => ({ ...prev, [scene.id]: !prev[scene.id] }))}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Versions
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Image */}
                    <div>
                      <Label className="text-xs">Generated Image</Label>
                      {scene.imageUrl ? (
                        <div className="mt-1 relative group">
                          <S3Image
                            src={scene.imageUrl}
                            alt={`Scene ${index + 1}`}
                            className="w-full rounded border"
                            width={400}
                            height={400}
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRegenerateScene(scene.id)}
                              disabled={regenerating[scene.id]}
                            >
                              {regenerating[scene.id] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              Regenerate
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-1 aspect-square bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                          <ImageIcon className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                    </div>

                    {/* Animation */}
                    <div>
                      <Label className="text-xs">Animation</Label>
                      {scene.animationUrl ? (
                        <div className="mt-1 relative group">
                          <S3Video
                            src={scene.animationUrl}
                            className="w-full rounded border"
                            controls
                            loop
                          />
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleRegenerateAnimation(scene.id)}
                              disabled={regenerating[`anim-${scene.id}`]}
                            >
                              {regenerating[`anim-${scene.id}`] ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : scene.imageUrl ? (
                        <div className="mt-1 aspect-square bg-gray-100 dark:bg-gray-800 rounded flex flex-col items-center justify-center gap-2">
                          <Film className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                          <Button
                            size="sm"
                            onClick={() => handleRegenerateAnimation(scene.id)}
                            disabled={regenerating[`anim-${scene.id}`]}
                          >
                            {regenerating[`anim-${scene.id}`] ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            Animate
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-1 aspect-square bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center">
                          <Film className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Image Prompt */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs">Image Prompt</Label>
                      {editingScene === scene.id ? (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setScenePrompts({ ...scenePrompts, [scene.id]: scene.prompt });
                              setEditingScene(null);
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleRegenerateScene(scene.id)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            Save & Regenerate
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingScene(scene.id)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {editingScene === scene.id ? (
                      <Textarea
                        value={scenePrompts[scene.id]}
                        onChange={(e) => setScenePrompts({ ...scenePrompts, [scene.id]: e.target.value })}
                        rows={3}
                        className="text-sm"
                      />
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        {scene.prompt}
                      </p>
                    )}
                  </div>

                  {/* Animation Prompt */}
                  {scene.animationPrompt && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Animation Prompt</Label>
                        {editingAnimationPrompt === scene.id ? (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingAnimationPrompt(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleRegenerateAnimation(scene.id)}
                            >
                              <Save className="w-4 h-4 mr-2" />
                              Save & Regenerate
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingAnimationPrompt(scene.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      {editingAnimationPrompt === scene.id ? (
                        <Textarea
                          value={animationPrompts[scene.id] || scene.animationPrompt}
                          onChange={(e) => setAnimationPrompts({ ...animationPrompts, [scene.id]: e.target.value })}
                          rows={2}
                          className="text-sm"
                        />
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          {scene.animationPrompt}
                        </p>
                      )}
                    </div>
                  )}

                  {scene.error && (
                    <div className="mt-2 p-2 bg-red-50 text-red-700 text-sm rounded">
                      Error: {scene.error}
                    </div>
                  )}

                  {/* Version Selector */}
                  {showVersions[scene.id] && (
                    <div className="mt-4 border-t pt-4">
                      <SceneVersionSelector
                        sceneId={scene.id}
                        videoId={video.id}
                        onVersionChange={onUpdate}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No scenes generated yet
              </div>
            )}
          </TabsContent>

          <TabsContent value="output" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">Rendered Videos</h3>
              {video.status === "completed" && (
                <Button
                  size="sm"
                  onClick={() => handleRenderVideo()}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Render All Formats
                </Button>
              )}
            </div>

            {video.renderedVideos?.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {video.renderedVideos.map((rendered: any) => (
                  <div
                    key={rendered.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <Badge variant="outline" className="font-mono">
                        {rendered.format}
                      </Badge>
                      <Badge className={cn(
                        rendered.status === "completed" ? "bg-green-100 text-green-800" :
                        rendered.status === "rendering" ? "bg-blue-100 text-blue-800" :
                        "bg-red-100 text-red-800"
                      )}>
                        {rendered.status}
                      </Badge>
                      {rendered.status === "completed" && rendered.url && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Ready to download
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {rendered.status === "completed" && rendered.url && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              // Use proxy URL for playback
                              const proxyUrl = `/api/bulk-video/proxy-download?id=${rendered.id}`;
                              window.open(proxyUrl, "_blank");
                            }}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(rendered)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {rendered.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRenderVideo(rendered.format)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No videos rendered yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}