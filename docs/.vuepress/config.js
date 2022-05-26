module.exports = {
    plugins: [
        [
            'vuepress-plugin-mathjax',
            {
                target: 'chtml'
            }
        ],
        [
            'sitemap',
            {
                hostname: 'https://ladybug.top'
            }
        ],
        [
            'vuepress-plugin-baidu-autopush',
            {}
        ]
    ],
    // 移动端优化
    head: [
        ['meta', { name: 'viewport', content: 'width=device-width,initial-scale=1,user-scalable=no' }],
        ['meta', { name: "google-site-verification", content: "NL5qmCT5yDHkyrRJUGxdC-9yeoSzCGXptwYUFziA64s" }],
        ['link', { rel: 'icon', href: '/img/avatar/bitbug_favicon32.ico' }], //favicon图标设置
        ["script", { src: "scripts/myfooter.js" }]
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
        sidebarDepth: 2,
        displayAllHeaders: true,
        smoothScroll: true,
        author: '小松鼠',
        //authorAvatar: '/img/avatar/bitbug_favicon128.ico',
        logo: '/img/avatar/bitbug_favicon32.ico',
        nav: [
            { text: '主页', link: '/', icon: 'reco-home' },
            { text: '时间轴', link: '/timeline/', icon: 'reco-date' },
            { text: '常用网站', link: '/websites', icon: 'reco-document' },
            { text: '留言板', link: '/messageboard', icon: 'reco-suggestion' },
            { text: 'GitHub', link: 'https://github.com/yinyicao', icon: 'reco-github' }
        ],
        // 博客配置
        blogConfig: {
            category: {
                location: 2, // 在导航栏菜单中所占的位置，默认2
                text: '分类' // 默认文案 “分类”
            },
            tag: {
                location: 3, // 在导航栏菜单中所占的位置，默认3
                text: '标签' // 默认文案 “标签”
            }
        },
        //  // valine评论系统（showComment: false 默认不加载）
        //  valineConfig: {
        //   appId: 'MzWUFw6KWun6JXiHvkwwMdIF-gzGzoHsz',
        //   appKey: 'eKS3DlOEPpav4sMyuQYpBmO9', 
        //   showComment: false
        // },
        vssueConfig: {
            platform: 'github',
            owner: 'yinyicao',
            repo: 'yinyicao.github.io',
            clientId: '8e13003e6b6d3db2dfe3',
            clientSecret: '89926d894f5f5166a9b421f668234b8f81b42e0c'
        },
        // 备案
        record: '渝ICP备19002727号-2',
        recordLink: 'http://www.beian.miit.gov.cn/',
        cyberSecurityRecord: '渝公网安备 50022802000392号',
        cyberSecurityLink: 'www.beian.gov.cn/portal/registerSystemInfo?recordcode=50022802000392',
        // 项目开始时间，只填写年份
        startYear: '2020'
    }
}