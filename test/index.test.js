
import { createEffect, composeEffects, composeHandlers } from '../src';
import { sleep } from '../src/operations';

describe('createEffect', () => {
  const ConsoleEff = createEffect('ConsoleEff', {
    log: ['...data'],
  });

  const ApiEffect = createEffect('ApiEffect', {
    fetch: ['url', 'request'],
  });

  describe('Effect type', () => {
    it('should have type info', () => {
      expect(ApiEffect.name).toBe('ApiEffect');
    });

    it('should have fetch operation', () => {
      expect(ApiEffect.fetch).toBeInstanceOf(Function);
      expect(ApiEffect.fetch().name).toBe('fetch');
      expect(ApiEffect.fetch('/').payload).toEqual(['/']);
    });
  });

  describe('createRunner#cancel', () => {
    const DummyEff = createEffect('DummyEff', { myFn: [] });

    it('should', done => {
      const action = function *() {
        yield DummyEff.myFn();
        yield sleep(500);
        yield DummyEff.myFn();
        yield 'Yo';
      };
      
      const myFn = jest.fn();
      const run = DummyEff.handler({ myFn: ({ resume }) => () => resume(myFn()) });

      setTimeout(() => {
        run.cancel();
        expect(myFn).toBeCalledTimes(1);
        done();
      }, 100);

      run(action)
        .then(() => done('Shouldnt have reached here'))
        .catch(done);
    });
  });

  describe('composeEffects', () => {
    const action = function *() {
      const response = yield ApiEffect.fetch('/some-api');
      yield ConsoleEff.log(response);
      yield response.data;
    };

    it('should compose Api and IO effects', done => {
      const Effect = composeEffects(ApiEffect, ConsoleEff);

      const eff = Effect.handler({
        log: ({ resume }) => ({ data }) => {
          expect(data).toBe('wow');
          resume();
        },
        fetch: ({ resume }) => () => resume({ data: 'wow' }),
      });

      eff(action)
        .then(() => done())
        .catch(done);
    });
  });

  describe('composeHandlers', () => {
    const action = function *() {
      const response = yield ApiEffect.fetch('/some-api');
      yield ConsoleEff.log(response + ' world');
      yield response;
    };

    it('should compose Api and IO effects', done => {
      const logg = jest.fn();
      const api = ApiEffect.handler({
        fetch: ({ resume }) => () => resume('Hello'),
      });
      const konsole = ConsoleEff.handler({
        log: ({ resume }) => d => resume(logg(d)),
      });

      const eff = composeHandlers(api, konsole);

      eff(action)
        .then(data => {
          expect(data).toBe('Hello');
          expect(logg).toBeCalledWith('Hello world');
          done();
        })
        .catch(done);
    });
  });

  describe('example usage', () => {
    it('should resolve with the correct value for valid operation (fetch example)', done => {
      const api = ApiEffect.handler({
        fetch: ({ resume }) => (url, req) => setTimeout(() => resume({ url, req, data: 'wow' }), 500),
      });

      const action = function *() {
        const response = yield ApiEffect.fetch('/some-api');
        yield response.data;
      };

      api(action)
        .then(data => {
          expect(data).toBe('wow');
          done();
        })
        .catch(done);
    });

    it('should resolve with the correct value for valid operation (fetch example)', done => {
      const api = ApiEffect.handler({
        fetch: ({ resume }) => (url, req) => setTimeout(() => resume({ url, req, data: 'wow' }), 500),
      });

      const action = function *() {
        const response = yield ApiEffect.fetch('/some-api');
        yield ConsoleEff.log('Wrong operation');
        yield response.data;
      };

      api(action)
        .then(() => done('Shouldve thrown error'))
        .catch(e => {
          expect(e.message).toContain('Invalid operation');
          expect(e.message).toContain('"log"');
          done();
        });
    });
  });
});

