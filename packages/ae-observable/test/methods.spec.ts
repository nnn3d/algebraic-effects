import createObservable, { of, range, Subscription } from '../src';

describe('Observable methods', () => {
  describe('Observable#map', () => {
    it('should map over the items in the stream (increment)', done => {
      const onNext = jest.fn();

      of(1, 3, 10)
        .map(x => x + 10)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(3);
            expect(onNext.mock.calls).toEqual([[11], [13], [20]]);
            done();
          },
        });
    });

    it('should not map over the error in the stream (increment)', done => {
      const onError = jest.fn();
      const onNext = jest.fn();

      const error = new Error('Fuck');
      const obs = createObservable<number>((subscription: Subscription) => {
        subscription.throwError(error);
        subscription.complete();
      });

      obs
        .map(x => x + 10)
        .subscribe({
          onError,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(0);
            expect(onError).toBeCalledTimes(1);
            expect(onError).toHaveBeenCalledWith(error);
            done();
          },
        });
    });
  });

  describe('Observable#filter', () => {
    it('should filter all even numbers in the stream', done => {
      const onNext = jest.fn();

      range(0, 10)
        .filter(x => x % 2 === 0)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(5);
            expect(onNext.mock.calls).toEqual([[0], [2], [4], [6], [8]]);
            done();
          },
        });
    });

    it('should not map over the error in the stream (increment)', done => {
      const onError = jest.fn();
      const onNext = jest.fn();

      const error = new Error('Fuck');
      const appendThrow = x => createObservable(sub => {
        sub.throwError(error);
        sub.resolve(x);
      });

      range(0, 10)
        .chain(appendThrow)
        .filter(x => x % 2 === 0)
        .subscribe({
          onError,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(5);
            expect(onError).toBeCalledTimes(10);
            expect(onError).toHaveBeenCalledWith(error);
            done();
          },
        });
    });
  });

  describe('Observable#fold', () => {
    it('should fold the items in the stream (increment both error and value)', done => {
      const onNext = jest.fn();
      const obs = createObservable<number, number>((subscription: Subscription) => {
        subscription.next(1);
        subscription.next(3);
        subscription.throwError(10);
        subscription.throwError(5);
        subscription.complete();
      });

      obs
        .propagateTo(e => e + 10, x => x + 3)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(4);
            expect(onNext.mock.calls).toEqual([[4], [6], [20], [15]]);
            done();
          },
        });
    });

    it('should fold the items in the stream (group both error and value)', done => {
      const onNext = jest.fn();
      const obs = createObservable<Error, string>((subscription: Subscription) => {
        subscription.next('Hello');
        subscription.throwError(new Error('Break'));
        subscription.next('world');
        subscription.complete();
      });

      obs
        .propagateTo(
          e => ({ error: e.message }),
          x => ({ str: x }),
        )
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(3);
            expect(onNext.mock.calls).toEqual([
              [{ str: 'Hello' }],
              [{ error: 'Break' }],
              [{ str: 'world' }],
            ]);
            done();
          },
        });
    });
  });

  describe('Observable#chain', () => {
    
    it('should chain the two in the stream (increment)', done => {
      const onNext = jest.fn();

      const add10Stream = (x: number) => createObservable(sub => {
        sub.next(x + 10);
        sub.complete();
      });

      of(1, 3, 10)
        .chain(add10Stream)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(3);
            expect(onNext.mock.calls).toEqual([[11], [13], [20]]);
            done();
          },
        });
    });

    it('should not chain the error in the stream (increment)', done => {
      const onError = jest.fn();
      const onNext = jest.fn();

      const error = new Error('Fuck');
      const obs = createObservable<number>((subscription: Subscription) => {
        subscription.throwError(error);
        subscription.complete();
      });

      const throwErrorStream = () => createObservable(sub => {
        sub.throwError('Err');
        sub.complete();
      });

      obs
        .chain(throwErrorStream)
        .subscribe({
          onError,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(0);
            expect(onError).toBeCalledTimes(1);
            expect(onError).toHaveBeenCalledWith(error);
            done();
          },
        });
    });
  });

  describe('Observable#tap', () => {
    it('should allow executing a function for every event in the stream', done => {
      const tapHandler = jest.fn();
      const onNext = jest.fn();
      const onError = jest.fn();

      const error = new Error('Fuck');
      const thrower = (n: number) => createObservable<number>((subscription: Subscription) => {
        subscription.throwError(error);
        subscription.next(n);
        subscription.complete();
      });

      of(1, 2, 3, 4, 5)
        .chain(thrower)
        .tap(tapHandler)
        .subscribe({
          onNext,
          onError,
          onComplete: () => {
            expect(tapHandler).toBeCalledTimes(5);
            expect(tapHandler.mock.calls).toEqual([[1], [2], [3], [4], [5]]);
            expect(onNext.mock.calls).toEqual([[1], [2], [3], [4], [5]]);
            expect(onError.mock.calls).toEqual(Array(5).fill([error]));
            done();
          },
        });
    });
  });

  describe('Observable#merge', () => {
    const sort = (list: any[]) => list.map(x => `${x}`).sort().join(',');
    
    it('should merge the two in the stream', done => {
      const onNext = jest.fn();

      const stream1$ = of(1, 3, 5);
      const stream2$ = of(4, 6);

      stream1$
        .merge(stream2$)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(5);
            expect(sort(onNext.mock.calls)).toBe('1,3,4,5,6');
            done();
          },
        });
    });

    it('should merge the errors in the stream', done => {
      const onError = jest.fn();
      const onNext = jest.fn();

      const obs = createObservable<number>((sub: Subscription) => {
        sub.throwError(new Error('Whoa'));
        sub.resolve('ok1');
      });

      const throwErrorStream = createObservable(sub => {
        sub.throwError(new Error('Fuck'));
        sub.throwError(new Error('Off'));
        sub.resolve('ok2');
      });

      obs
        .merge(throwErrorStream)
        .subscribe({
          onError,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(2);
            expect(onError).toBeCalledTimes(3);
            expect(sort(onError.mock.calls)).toBe('Error: Fuck,Error: Off,Error: Whoa');
            expect(sort(onNext.mock.calls)).toBe('ok1,ok2');
            done();
          },
        });
    });

    it('should complete only when both streams complete', done => {
      const onError = jest.fn();
      const onNext = jest.fn();

      const stream$ = createObservable<number>((sub: Subscription) => {
        sub.resolve('ok1');
      });

      const altStream$ = createObservable(sub => {
        setTimeout(() => {
          sub.resolve('ok2');
        }, 105);
      });

      const startTime = Date.now();

      stream$
        .merge(altStream$)
        .subscribe({
          onError,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(2);
            expect(onError).toBeCalledTimes(0);
            expect(sort(onNext.mock.calls)).toBe('ok1,ok2');
            expect(Date.now() - startTime).toBeGreaterThanOrEqual(100);
            done();
          },
        });
    });

    it('should stop events from a stream after completion of that stream', done => {
      const onNext = jest.fn();

      const obs = createObservable<number>((sub: Subscription) => {
        sub.resolve('ok1');
        sub.next('not ok1');
        sub.throwError('Fuck');
      });

      const throwErrorStream = createObservable(sub => {
        sub.resolve('ok2');
        sub.next('not ok2');
        sub.throwError('Fuck');
      });

      obs
        .merge(throwErrorStream)
        .subscribe({
          onError: done,
          onNext,
          onComplete: () => {
            expect(onNext).toBeCalledTimes(2);
            expect(sort(onNext.mock.calls)).toBe('ok1,ok2');
            done();
          },
        });
    });
  });
});

