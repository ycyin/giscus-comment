---
title: 获取下一个完全对称日
tags:
  - Python
keywords:
  - 完全对称日
date: 2021-12-02 13:22:29
categories: 算法&数学
description: 使用Python来获取下一个完全对称日
---


## 前言

今日热点：20211202完全对称日。其实就是数学上的回文数，获取下一个完全对称日可以利用python的字符串切片判断即可。

## 代码

```python
#!/usr/bin/python3
import time
now = int(time.time()) 
while (1):
    now  = now + 60*60*24
    timeStruct = time.localtime(now) 
    strTime = time.strftime("%Y%m%d", timeStruct)
    if strTime[::-1]==strTime:
        print('The next palindrome day:',strTime) #py timeR.py  --> The next palindrome day: 20300302
        break;
```



运行得出，20211202下一个完全对称日为20300302。
