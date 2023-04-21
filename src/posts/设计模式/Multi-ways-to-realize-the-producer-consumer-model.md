---
title: 三种常用的生产者消费者模式实现
date: 2022-01-12 11:19:23
tags:
  - 生产者与消费者模式
  - 软件设计
categories: 设计模式
---

> 本篇是在学习[5.Thread和Object中线程相关的重要方法 (ladybug.top)](https://notes.ladybug.top/#/Java/Java线程/Thread和Object中线程相关的重要方法)时对`notify()`和`wait()`的相关用法记录。<span style="font-size:10px">本篇除代码外多处引用网上文字，具体出处见文末参考。</span>
>
> 生产者消费者模式并不是GOF提出的23种设计模式之一，23种设计模式都是建立在面向对象的基础之上的，但其实面向过程的编程中也有很多高效的编程模式，生产者消费者模式便是其中之一，它是我们编程过程中最常用的一种设计模式。

在实际的软件开发过程中，经常会碰到如下场景：某个模块负责产生数据，这些数据由另一个模块来负责处理（此处的模块是广义的，可以是类、函数、线程、进程等）。产生数据的模块，就形象地称为生产者；而处理数据的模块，就称为消费者。

单单抽象出生产者和消费者，还不算是生产者／消费者模式。该模式还需要有一个缓冲区处于生产者和消费者之间，作为一个中介。

![](./Multi-ways-to-realize-the-producer-consumer-model/mo435bveket.png)

实现消费者生产者模式有很多种方式，可以在文末参考中找到，我认为常用的有**BlockingQueue**、**condition**、**wait/notify**三种实现方式，虽说是三种实现方式但是本次都是差不多的。

下面的例子，使用三种方法实现生产者消费者模式，完成生产者生产100条数据，消费者消费100条数据。

## 方式一：用BlockingQueue 实现

使用这种方式，只需要使用`ArrayBlockingQueue`类型的`BlockingQueue`命名为`queue`，并指定固定容量。然后生产者使用`queue.put()`负责往队列添加数据，消费者使用`queue.take()`负责消费数据。

```java
public class ConsumerProducerWithBlockingQueue {

    public static void main(String[] args) {
        ConsumerProducerWithBlockingQueue cpwb = new ConsumerProducerWithBlockingQueue();
        ArrayBlockingQueue<Object> blockingQueue = new ArrayBlockingQueue<>(10);
        Producer producer = cpwb.new Producer(blockingQueue);

        Consumer consumer = cpwb.new Consumer(blockingQueue);

        producer.start();
        consumer.start();
    }

    class Consumer extends Thread {
        private BlockingQueue<Object> queue;
        public Consumer(BlockingQueue queue) {
            this.queue = queue;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i <= 100; i++) {
                    System.out.println("消费者取出：" + queue.take()+"仓库还有"+queue.size());
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    class Producer extends Thread {
        private BlockingQueue<Object> queue;
        public Producer(BlockingQueue queue) {
            this.queue = queue;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i <= 100; i++) {
                    System.out.println("生产者放入："+i);
                    queue.put(i);
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}
```

虽然代码非常简单，但实际上`ArrayBlockingQueue`已经在背后完成了很多工作，比如队列满了就去阻塞生产者线程，队列有空就去唤醒生产者线程等。比如从`ArrayBlockingQueue`的`take()`源码中可以看出，它为我们使用Condition 实现的方式实现了。

```java
public E take() throws InterruptedException {
    final ReentrantLock lock = this.lock;
    lock.lockInterruptibly();
    try {
        while (count == 0)
            notEmpty.await();
        return dequeue();
    } finally {
        lock.unlock();
    }
}
```

## 方式二：用 Condition 实现

利用 Condition 实现生产者消费者模式，与BlockingQueue背后的实现原理非常相似，相当于我们自己实现一个简易版的 BlockingQueue：

定义了一个队列变量 queue 并设置最大容量为 10；定义了一个 ReentrantLock 类型的 Lock 锁，并在 Lock 锁的基础上创建两个 Condition，一个是 notEmpty，另一个是 notFull，分别代表队列没有空和没有满的条件；声明put 和 take 这两个核心方法。

```java
public class ConsumerProducerWithCondition {

    private Queue queue;

    private int maxSize = 10;

    private ReentrantLock lock = new ReentrantLock();

    private Condition notFull = lock.newCondition();

    private Condition notEmpty = lock.newCondition();

    public ConsumerProducerWithCondition() {
        this.queue = new LinkedList();
    }

    public void put(Object obj) throws InterruptedException {
        lock.lock();
        try {
            while (queue.size() == maxSize) {
                notFull.await(); //不要写成了 .wait()
            }
            queue.add(obj);
            notEmpty.signalAll();
        }finally {
            lock.unlock();
        }
    }

    public Object take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await();
            }
            Object item = queue.remove();
            notFull.signalAll();
            return item;
        }finally {
            lock.unlock();
        }
    }


    public static void main(String[] args) {
        ConsumerProducerWithCondition consumerProducer = new ConsumerProducerWithCondition();

        ConsumerProducerWithCondition.Consumer consumer = consumerProducer.new Consumer(consumerProducer);

        ConsumerProducerWithCondition.Producer producer = consumerProducer.new Producer(consumerProducer);

        producer.start();
        consumer.start();
    }

    class Consumer extends Thread {

        private ConsumerProducerWithCondition consumerProducer;

        public Consumer(ConsumerProducerWithCondition consumerProducer) {
            this.consumerProducer = consumerProducer;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i < 100; i++) {
                    Object take = consumerProducer.take();
                    System.out.println("消费者取出：" + take+"仓库还有"+queue.size());
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    class Producer extends Thread {

        private ConsumerProducerWithCondition consumerProducer;


        public Producer(ConsumerProducerWithCondition consumerProducer) {
            this.consumerProducer = consumerProducer;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i < 100; i++) {
                    System.out.println("生产者放入："+i);
                    consumerProducer.put(i);
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }
}
```

因为生产者消费者模式通常是面对多线程的场景，需要一定的同步措施保障线程安全，所以在 put 方法中先将 Lock 锁上，然后，在 while 的条件里检测 queue 是不是已经满了，如果已经满了，则调用 notFull 的 await() 阻塞生产者线程并释放 Lock，如果没有满，则往队列放入数据并利用 notEmpty.signalAll() 通知正在等待的所有消费者并唤醒它们。最后在 finally 中利用 lock.unlock() 方法解锁，把 unlock 方法放在 finally 中是一个基本原则，否则可能会产生无法释放锁的情况。

take 方法实际上是与 put 方法相互对应的，同样是通过 while 检查队列是否为空，如果为空，消费者开始等待，如果不为空则从队列中获取数据并通知生产者队列有空余位置，最后在 finally 中解锁。

**注意：**这里需要注意判断队列是否为空、是否为满的状态需要使用while来判断，和下面的方式三一样。这在[oracle官方Object对象的wait()方法](https://docs.oracle.com/javase/8/docs/api/java/lang/Object.html#wait--)有说明：As in the one argument version, interrupts and spurious wakeups are possible, and this method should always be used in a loop。

**为什么在take()方法中使用while( queue.size() == 0 ) 判断而不是用if来判断？**

> 思考这样一种情况，因为生产者消费者往往是多线程的，我们假设有两个消费者，第一个消费者线程获取数据时，发现队列为空，便进入等待状态；因为第一个线程在等待时会释放 Lock 锁，所以第二个消费者可以进入并执行 if( queue.size() == 0 )，也发现队列为空，于是第二个线程也进入等待；而此时，如果生产者生产了一个数据，便会唤醒两个消费者线程，而两个线程中只有一个线程可以拿到锁，并执行 queue.remove 操作，另外一个线程因为没有拿到锁而卡在被唤醒的地方，而第一个线程执行完操作后会在 finally 中通过 unlock 解锁，而此时第二个线程便可以拿到被第一个线程释放的锁，继续执行操作，也会去调用 queue.remove 操作，然而这个时候队列已经为空了，所以会抛出 NoSuchElementException 异常，这不符合我们的逻辑。而如果用 while 做检查，当第一个消费者被唤醒得到锁并移除数据之后，第二个线程在执行 remove 前仍会进行 while 检查，发现此时依然满足 queue.size() == 0 的条件，就会继续执行 await 方法，避免了获取的数据为 null 或抛出异常的情况。

## 方式三：用 wait/notify 实现

使用 `wait/notify` 实现生产者消费者模式的方法，实际上实现原理和前面两种是非常类似的。这为我们理解wait和notify提供了很大的帮助。

最主要的部分仍是 take 与 put 方法，put 方法被 synchronized 保护，while检查队列是否为满，如果不满就往里放入数据并通过`notify()`或`notifyAll()`唤醒其他线程。同样，take方法也被synchronized修饰，while检查队列是否为空，如果不为空就获取数据并唤醒其他线程。

```java
public class ConsumerProducerWithWaitNotify {
    public static void main(String[] args) {
        ConsumerProducerWithWaitNotify consumerProducer = new ConsumerProducerWithWaitNotify();

        EventStorge eventStorge = consumerProducer.new EventStorge();

        Consumer consumer = consumerProducer.new Consumer(eventStorge);

        Producer producer = consumerProducer.new Producer(eventStorge);

        producer.start();
        consumer.start();
    }

    class Consumer extends Thread {
        private EventStorge storge;
        public Consumer(EventStorge storge) {
            this.storge = storge;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i < 100; i++) {
                    storge.take();
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    class Producer extends Thread {
        private EventStorge storge;
        public Producer(EventStorge storge) {
            this.storge = storge;
        }

        @Override
        public void run() {
            try {
                for (int i = 0; i < 100; i++) {
                    storge.put(i);
                }
            } catch (InterruptedException e) {
                e.printStackTrace();
            }
        }
    }

    class EventStorge {
        private LinkedList<Integer> list=null;
        private int maxSize = 0;

        public EventStorge() {
            this.list = new LinkedList<>();
            this.maxSize = 10;
        }

        public synchronized void put(int num) throws InterruptedException {
            while (list.size() == maxSize) { // not if
                wait();
            }
            System.out.println("生产者放入"+num+"---");
            list.add(num);
            notify();
        }

        public synchronized void take() throws InterruptedException {
            while (list.isEmpty()) {
                wait();
            }
            notify();
            System.out.println("消费者取出 " + list.poll() +"还有" + list.size()+"个");
        }

    }

}
```

## 总结

这三种方式实现生产者消费者模式，从编码难度上来说第一种使用BlockingQueue实现是最简单的，但实际上其底层的逻辑在方式二、方式三中得以体现。这三种 方式均需要一个队列，然后要有锁来控制生产者和消费者。

除此三种方式外，还有使用信号量(数据库连接池)、管道流(只适合两个线程间通信)等方式实现生产者消费者模式，我觉得都是差不多的原理。

## 参考

1. [生产者/消费者模式的理解及实现（整理） - Luego - 博客园 (cnblogs.com)](https://www.cnblogs.com/luego/p/12048857.html)
2. [Java多种方式解决生产者消费者问题（十分详细）_爱你の大表哥的博客-CSDN博客_java生产者消费者](https://blog.csdn.net/ldx19980108/article/details/81707751)
3. [Java并发编程(六)——三种方式实现生产者消费者模式_易水寒的博客-CSDN博客](https://blog.csdn.net/yongbutingxide/article/details/116520778)
4. [java多线程wait时为什么要用while而不是if_worldchinalee的博客-CSDN博客_java wait while](https://blog.csdn.net/worldchinalee/article/details/83790790)
5. [Object (Java Platform SE 8 ) (oracle.com)](https://docs.oracle.com/javase/8/docs/api/java/lang/Object.html#wait--)

