import { defineUserConfig } from "vuepress";
import { searchProPlugin } from "vuepress-plugin-search-pro";
import { redirectPlugin } from "vuepress-plugin-redirect";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",
  // 移动端优化
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1,user-scalable=no' }],
    ['meta', { name: "google-site-verification", content: "NL5qmCT5yDHkyrRJUGxdC-9yeoSzCGXptwYUFziA64s" }],
    ['meta', { name: "google-adsense-account", content: "ca-pub-4454489863841699"  }],
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
    searchProPlugin({
      // 索引全部内容
      indexContent: true,
    }),
    redirectPlugin({
      // 重定向配置,为了不让之前收录到Google的访问是404链接
      config: (app) =>{
        // 如果是/posts/开头的页面就设置一条规则[访问url,重定向到url]
        // path = /posts/CloudNative/mysql-master-slave-in-docker-compose-and-use-of-percona-toolkit.html
        // replace(/^\/posts\//, "/") ===> path = /CloudNative/mysql-master-slave-in-docker-compose-and-use-of-percona-toolkit.html
        // replace('/CloudNative/','/云原生/') ==> /云原生/mysql-master-slave-in-docker-compose-and-use-of-percona-toolkit.html
        // 就生成一条：[/云原生/mysql-master-slave-in-docker-compose-and-use-of-percona-toolkit.html,/posts/CloudNative/mysql-master-slave-in-docker-compose-and-use-of-percona-toolkit.html]
        // 表示访问/云原生/... 时重定向到/posts/CloudNative/...
        // 兼容之前的版本
        const redirect1  = app.pages
        .filter(({ path }) => path.startsWith("/posts/"))
        .map(({ path }) => [
          path.replace(/^\/posts\//, "/")
          .replace('/Frontend/',"/前端技术/")
          .replace('/Database/','/数据库技术/')
          .replace('/CloudNative/','/云原生/')
          .replace('/Software/','/软件安装&配置/')
          .replace('/DesignPatterns/','/设计模式/')
          .replace('/WebAndSecurity/','/安全&设计/')
          .replace('/Concurrent/','/多线程/')
          .replace('/Commands/','/常用命令/')
          .replace('/Algorithms/','/算法&数学/'), path]);

        // 兼容上个中文路径的版本
        const redirect2  = app.pages
        .filter(({ path }) => path.startsWith("/posts/"))
        .map(({ path }) => [
          path.replace(/^\/posts\//, "/")
          .replace('/Frontend/',"/posts/前端技术/")
          .replace('/Database/','/posts/数据库技术/')
          .replace('/CloudNative/','/posts/云原生/')
          .replace('/Software/','/posts/软件安装与配置/')
          .replace('/DesignPatterns/','/posts/设计模式/')
          .replace('/WebAndSecurity/','/posts/Web技术与权限/')
          .replace('/Concurrent/','/posts/多线程/')
          .replace('/Commands/','/posts/常用命令/')
          .replace('/Algorithms/','/posts/算法And数学/'), path]);

        const redirects = redirect1.concat(redirect2)
        // console.log(redirects)
        return Object.fromEntries(
          redirects
        )
      },
    }),
  ],

  theme,

  // Enable it with pwa
  shouldPrefetch: false,
});
