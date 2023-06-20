---
title: 使用两个线程交替打印0-100的奇偶数
tag:
  - Thread
  - 多线程
keywords:
  - Thread
  - 多线程
  - 交替打印
date: 2022-01-10 17:12:06
category: 多线程
description: Java使用两个线程交替打印0-100的奇偶数
---
> 本篇是在学习[5.Thread和Object中线程相关的重要方法 (ladybug.top)](https://notes.ladybug.top/#/Java/Java线程/Thread和Object中线程相关的重要方法)时对`notify()`和`wait()`的相关用法记录。

## 方法一：使用同步锁

```java
public class PrintNumberWithTwoThread {
    private static final Object lock = new Object();
    private static int i = 0;
    public static void main(String[] args) throws InterruptedException {
        Thread1 thread1 = new Thread1();

        Thread2 thread2 = new Thread2();

        thread1.start();

        thread2.start();
    }

    static class Thread1 extends Thread {
        @Override
        public void run() {
            while (i < 100) {
                synchronized (lock) {
                    if ((i & 1) == 1) {
                        System.out.println("线程" + Thread.currentThread().getName() + ":" + i++);
                    }
                }
                // 打印出来就会发现进行了多次无效的循环
                // System.out.println("进入循环");
            }
        }
    }

    static class Thread2 extends Thread {

        @Override
        public void run() {
            while (i < 100) {
                synchronized (lock) {
                    if ((i & 1) == 0) {
                        System.out.println("线程" + Thread.currentThread().getName() + ":" + i++);
                    }
                }
                // System.out.println("进入循环");
            }
        }
    }
}
```

使用这种方法效率较低，会多次进入循环争夺锁。比如`Thread2`如果一直持有lock就会一直循环下去，变量不增加循环就不会结束，一直到另一个线程`Thread1`争夺到lock锁，以此反复，最终变量i自增到100,两个线程都结束循环，程序结束。

## 方法二：使用`notify()`和`wait()`

```java
public class PrintNumberWithTwoThread2 {
    private static final Object lock = new Object();
    private static int i = 0;

    public static void main(String[] args) throws InterruptedException {
        Target target = new Target();
        Thread thread1 = new Thread(target,"偶数");
        Thread thread2 = new Thread(target,"奇数");
        thread1.start();
        // 先让偶数线程启动
        Thread.sleep(100);
        thread2.start();
    }

    static class Target implements Runnable{
        @Override
        public void run() {
            while (i <= 100) {
                synchronized (lock) {
                    System.out.println("线程" + Thread.currentThread().getName() + ":" + i++);
                    lock.notify();
                    if (i <= 100) {
                        try {
                            lock.wait();
                        } catch (InterruptedException e) {
                            e.printStackTrace();
                        }
                    }
                }
            }
        }
    }
}
```

使用这种方式比方法一要好得多。线程启动后获取到lock锁，开始打印数据，打印后调用`notify()`通知另一个线程，本线程因为调用`wait()`方法进入"Waiting"状态并释放锁，另一个线程获取锁，打印数据，调用`notify()`通知另一个线程，以此反复完成变量i自增到100结束线程。

