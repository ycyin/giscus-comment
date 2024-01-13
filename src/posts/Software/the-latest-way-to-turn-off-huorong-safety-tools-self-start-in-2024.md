---
title: 2024年最新关闭火绒安全工具的开机自启方法
date: 2024-01-14 01:37:46
tag:
  - Huorong
category: 软件安装&配置
---

火绒安全软件5.0下线“火绒剑”安全工具，[关于火绒安全软件5.0下线“火绒剑”安全工具的通知 (huorong.cn)](https://www.huorong.cn/info/17005357611095.html)，现在想要关闭火绒的开机自启得花点心思。大致方法如下：

<!-- more -->

1. 使用火绒剑独立安装版本，关闭火绒的启动项；
2. 进入Windows的安全模式，更改HipsDaemon(Huorong Internet Security Daemon)系统服务为手动

## 火绒剑关闭启动项
根据网上的方法下载文末的火绒剑独立版，关闭火绒服务即可。

## 修改系统服务
1. 设置 -> 系统 -> 恢复 -> 高级启动（进入安全模式）
2. `Win + R`输入`services.msc`回车进入
3. 找到HipsDaemon(Huorong Internet Security Daemon)这个服务设置为手动
4. 还有另外一个Huorong Windows Security...服务关不掉不用管，直接重启电脑即可

## 注意
关闭火绒开机自启后，如果想要临时启动使用一次，直接进入火绒界面，会提示火绒服务异常，一定不要点击界面上的提示来修复，一定不要！不然它又会把HipsDaemon系统服务设置为自动启动。

正确的方法是手动将HipsDaemon(Huorong Internet Security Daemon)这个服务启动，再进入火绒界面。关机前再使用火绒剑禁掉自启动。

## *说明：*

本文的方法和涉及的工具均来自网络非原创，来源如下：
方法：https://www.bilibili.com/read/cv23414303/
火绒剑独立版：https://www.52pojie.cn/thread-1859777-1-1.html