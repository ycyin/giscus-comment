import { navbar } from "vuepress-theme-hope";

export const zhNavbar = navbar([
  "/",
  {
    text: "全部博文",
    icon: "edit",
    link: "/posts/",
  },
  {
    text: "关于我",
    icon: "edit",
    link: "/intro",
  },
]);
