module.exports = {
  // 移动端优化
  head: [
    ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1,user-scalable=no' }]
  ],
  title: '敲代码的小松鼠',
  locales: {
    '/': {
      lang: 'zh-CN'
    }
  },
  theme: 'reco',
  themeConfig: {
   type: 'blog',
   sidebar: 'auto',
   smoothScroll: true,
   author: '小松鼠',
   //authorAvatar: '/img/avatar/bitbug_favicon128.ico',
   logo: '/img/avatar/bitbug_favicon32.ico',
   nav: [
     { text: '主页', link: '/',icon: 'reco-home' },
     { text: '时间轴', link: '/timeline/', icon: 'reco-date' },
     { text: 'GitHub', link: 'https://github.com/yinyicao',icon: 'reco-github' }
   ],
    // 博客配置
   blogConfig: {
     category: {
       location: 2,     // 在导航栏菜单中所占的位置，默认2
       text: '分类' // 默认文案 “分类”
     },
     tag: {
       location: 3,     // 在导航栏菜单中所占的位置，默认3
       text: '标签'      // 默认文案 “标签”
     }
   },
    // 备案
    record: 'ICP 备案文案',
    recordLink: 'ICP 备案指向链接',
    cyberSecurityRecord: '公安部备案文案',
    cyberSecurityLink: '公安部备案指向链接',
    // 项目开始时间，只填写年份
    startYear: '2020'
 }
}