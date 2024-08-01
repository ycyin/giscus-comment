import { defineUserConfig } from "vuepress";
import theme from "./theme.js";
import { viteBundler } from '@vuepress/bundler-vite'

export default defineUserConfig({
  base: "/",
  bundler: viteBundler(),
  // 移动端优化
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1,user-scalable=no' }],
    ['meta', { name: "google-site-verification", content: "NL5qmCT5yDHkyrRJUGxdC-9yeoSzCGXptwYUFziA64s" }],
    ['meta', { name: "google-adsense-account", content: "ca-pub-4454489863841699"  }],
    ['meta', { name: "baidu_union_verify", content: "ca6e3517bd64c7a8ad0842d09d38c2ed"  }],
    ['meta', { name: "sogou_site_verification", content: "5FKlJOmzId"  }],
    ['meta', { name: "360-site-verification", content: "d4de18b1502aff3b93dd87c4401d9e4e"  }],
    ['link', { rel: 'icon', href: '/img/avatar/bitbug_favicon32.ico' }], //favicon图标设置
  ],
  title: '敲代码的小松鼠',
  locales: {
    "/": {
      lang: "zh-CN",
      title: "敲代码的小松鼠",
      description: "敲代码的小松鼠,ycyin的博客,小松鼠的博客",
    },
  },
  plugins: [
  ],

  theme,

  // Enable it with pwa
  shouldPrefetch: false,
  // 插件API Hooks 启动开发服务器并开始监听文件修改后被调用 https://vuejs.press/zh/reference/plugin-api.html#onwatched
  onWatched: () =>{
    console.log("onWatched")
  },
});
