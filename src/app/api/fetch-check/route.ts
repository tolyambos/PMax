import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // Get project ID from URL query parameter
    const url = new URL(req.url);
    const projectId = url.searchParams.get("id");

    if (!projectId) {
      return NextResponse.json(
        { error: "No project ID provided" },
        { status: 400 }
      );
    }

    console.log(
      `[FETCH-CHECK]: Testing both fetch methods for project ${projectId}`
    );

    // Test method 1: Direct API call
    console.log(`[FETCH-CHECK]: Method 1 - Calling debug-project API`);
    const directResponse = await fetch(
      `${url.origin}/api/debug-project?id=${projectId}`
    );
    const directData = await directResponse.json();

    // Test method 2: tRPC call
    console.log(`[FETCH-CHECK]: Method 2 - Calling tRPC directly via HTTP`);
    // Need to make a tRPC compatible query
    const trpcResponse = await fetch(
      `${url.origin}/api/trpc/project.getById?batch=1&input={"0":{"id":"${projectId}"}}`
    );
    const trpcData = await trpcResponse.json();

    return NextResponse.json({
      success: true,
      direct: {
        status: directResponse.status,
        hasProject: !!directData.project,
        sceneCount: directData.project?.scenes?.length || 0,
        firstSceneData: directData.project?.scenes?.[0]
          ? {
              id: directData.project.scenes[0].id,
              elementCount: directData.project.scenes[0].elements?.length || 0,
              hasAnimationStatus:
                !!directData.project.scenes[0].animationStatus,
            }
          : null,
      },
      trpc: {
        status: trpcResponse.status,
        result: trpcData,
        hasScenes: !!trpcData?.[0]?.result?.data?.scenes,
        sceneCount: trpcData?.[0]?.result?.data?.scenes?.length || 0,
        firstSceneData: trpcData?.[0]?.result?.data?.scenes?.[0]
          ? {
              id: trpcData[0].result.data.scenes[0].id,
              elementCount:
                trpcData[0].result.data.scenes[0].elements?.length || 0,
              hasAnimationStatus:
                !!trpcData[0].result.data.scenes[0].animationStatus,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("[FETCH-CHECK]: Error checking fetch methods:", error);
    return NextResponse.json(
      { error: "Failed to check fetch methods" },
      { status: 500 }
    );
  }
}
