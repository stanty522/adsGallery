export interface Creative {
  id: number;
  name: string;
  creativeType: string;
  creativeFormat: string;
  platform: string;
  aiActor: string;
  cameraAngle: string;
  metaFormat: "video" | "image" | "carousel";
  link916: string | null;
  link45: string | null;
  link45Static: string | null;
  carouselImages: string[];
}

export interface FilterOptions {
  creativeTypes: string[];
  creativeFormats: string[];
  platforms: string[];
  metaFormats: string[];
}

export interface ApiResponse {
  creatives: Creative[];
  filters: FilterOptions;
}
