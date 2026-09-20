import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VioEdu",
    short_name: "VioEdu",
    description: "Quản lý lịch học VioEdu theo nhóm và thành viên",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#4f46e5",
  };
}
