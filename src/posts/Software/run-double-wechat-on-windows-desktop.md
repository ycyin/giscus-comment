---
title: 在Windows上运行两个微信的简单脚本
tag:
  - bat脚本
  - 微信双开
keywords:
  - bat脚本
  - 微信双开
date: 2021-06-02 12:10:00
category: 软件安装&配置
description: Windows微信双开简单bat脚本
---
教程：新建一个任意命名的`.bat`文件，然后编辑文件输入微信安装地址，然后在每一行前面输入`start`，有几行代表多开几个微信。比如以下脚本表示要开两个微信：

```bash
start D:\"Program Files (x86)\Tencent\WeChat\"WeChat.exe
start D:\"Program Files (x86)\Tencent\WeChat\"WeChat.exe
```

`注：将地址中间部分使用双引号("")引起来,是因为bat脚本中一般带有空格的路径都要加引号`

