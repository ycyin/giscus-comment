---
title: Linux上直接打开war包修改文件
tags:
  - Linux
  - vi
keywords:
  - 直接打开文件
  - 修改war
date: 2021-06-11 16:31:54
categories: 常用命令
description: linux上直接打开war包修改文件内容。
---
### 前言

生产war包直接上传服务器上线，上传完了才发现某个配置文件的某个配置忘记修改，第一次使用vim命令直接打开war包修改文件内容，记录一下。

### 直接打开包修改文件

cd到war包所在目录，运行命令 `vim xxx.war`

```bash
vim xxx.war
```

此时便可以看到war包内根目录下的所有文件，可以使用vim命令进行当前目录下的文件查找，以及gg等相关命令。以`reids.properties`文件为例：

输入如下查找命令查找文件

```
/reids.properties
```

光标移动到该文件上之后*敲回车*，进入编辑界面.

更改文件后，使用vim命令保存并退出即可。



*参考链接(有删改)*：https://www.orchome.com/703