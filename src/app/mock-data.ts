// Mock data for development without needing backend/database
// This file would be removed in production

export const mockProjects = [
  {
    id: "1",
    name: "Nike Air Max 2024 Launch",
    description:
      "Product video showcasing the new Air Max collection with dynamic visuals",
    format: "9:16",
    createdAt: new Date(Date.now() - 3600000),
    updatedAt: new Date(Date.now() - 1800000),
    thumbnail: "https://picsum.photos/seed/101/300/600",
  },
  {
    id: "2",
    name: "Apple iPhone 15 Pro",
    description:
      "Tech product video highlighting camera features and titanium design",
    format: "16:9",
    createdAt: new Date(Date.now() - 86400000),
    updatedAt: new Date(Date.now() - 43200000),
    thumbnail: "https://picsum.photos/seed/102/600/300",
  },
  {
    id: "3",
    name: "Starbucks Holiday Menu",
    description:
      "Category video featuring seasonal drinks and festive atmosphere",
    format: "1:1",
    createdAt: new Date(Date.now() - 172800000),
    updatedAt: new Date(Date.now() - 86400000),
    thumbnail: "https://picsum.photos/seed/103/300/300",
  },
  {
    id: "4",
    name: "Tesla Model S Plaid",
    description:
      "Luxury product video with cinematic shots and performance highlights",
    format: "16:9",
    createdAt: new Date(Date.now() - 259200000),
    updatedAt: new Date(Date.now() - 172800000),
    thumbnail: "https://picsum.photos/seed/104/600/300",
  },
  {
    id: "5",
    name: "Lululemon Wellness Collection",
    description:
      "Category video for activewear with lifestyle and fitness focus",
    format: "9:16",
    createdAt: new Date(Date.now() - 345600000),
    updatedAt: new Date(Date.now() - 259200000),
    thumbnail: "https://picsum.photos/seed/105/300/600",
  },
  {
    id: "6",
    name: "Rolex Submariner",
    description:
      "Luxury product video with premium cinematography and detail shots",
    format: "1:1",
    createdAt: new Date(Date.now() - 432000000),
    updatedAt: new Date(Date.now() - 345600000),
    thumbnail: "https://picsum.photos/seed/106/300/300",
  },
];

export const mockAssets = [
  {
    id: "1",
    name: "Product Photo 1",
    type: "image",
    url: "https://picsum.photos/seed/201/600/600",
    thumbnail: "https://picsum.photos/seed/201/300/300",
    tags: "product,photo",
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "2",
    name: "Background Texture",
    type: "image",
    url: "https://picsum.photos/seed/202/600/600",
    thumbnail: "https://picsum.photos/seed/202/300/300",
    tags: "background,texture",
    createdAt: new Date(Date.now() - 172800000),
  },
  {
    id: "3",
    name: "Brand Logo",
    type: "image",
    url: "https://picsum.photos/seed/203/600/600",
    thumbnail: "https://picsum.photos/seed/203/300/300",
    tags: "logo,brand",
    createdAt: new Date(Date.now() - 259200000),
  },
  {
    id: "4",
    name: "Product Demo Video",
    type: "video",
    url: "https://example.com/video.mp4",
    thumbnail: "https://picsum.photos/seed/204/300/300",
    tags: "product,demo,video",
    createdAt: new Date(Date.now() - 345600000),
  },
  {
    id: "5",
    name: "Background Music",
    type: "audio",
    url: "https://example.com/audio.mp3",
    tags: "music,background",
    createdAt: new Date(Date.now() - 432000000),
  },
];

export const mockScenes = [
  {
    id: "scene1",
    order: 0,
    duration: 3,
    imageUrl: "https://picsum.photos/seed/101/800/1200",
    elements: [],
  },
  {
    id: "scene2",
    order: 1,
    duration: 3,
    imageUrl: "https://picsum.photos/seed/102/800/1200",
    elements: [],
  },
  {
    id: "scene3",
    order: 2,
    duration: 3,
    imageUrl: "https://picsum.photos/seed/103/800/1200",
    elements: [],
  },
];
