import _, { toNumber, mapValues, isArray, isPlainObject, set } from 'lodash-es';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import isLeapYear from 'dayjs/plugin/isLeapYear';
import relativeTime from 'dayjs/plugin/relativeTime';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
import { reactive } from '@vue/reactivity';
import { arrayToTree } from 'performant-array-to-tree';
import { watch } from '../utils/watchReactivity';
import { LIST_ITEM_EXP, LIST_ITEM_INDEX_EXP } from '../constants';
(window as any).parse = parseExpression;

dayjs.extend(relativeTime);
dayjs.extend(isLeapYear);
dayjs.extend(LocalizedFormat);
dayjs.locale('zh-cn');

type Exp = string | Exp[];

// TODO: use web worker
const builtIn = {
  dayjs,
  _,
  // TODO: It is a custom dependency, should not be add here
  arrayToTree,
};

function isNumeric(x: string | number) {
  return !isNaN(Number(x)) && x !== '';
}

export function initStateManager() {
  return new StateManager();
}

export class StateManager {
  store = reactive<Record<string, any>>({});

  evalExp(exp: Exp, scopeObject = {}): unknown {
    if (typeof exp === 'string') {
      return exp;
    }

    const evalText = exp.map(ex => this.evalExp(ex, scopeObject)).join('');
    let evaled;
    try {
      evaled = new Function(`with(this) { return ${evalText} }`).call({
        ...this.store,
        ...builtIn,
        ...scopeObject,
      });
    } catch (e: any) {
      return evalText;
    }
    return evaled;
  }

  maskedEval(raw: string, evalListItem = false, scopeObject = {}) {
    if (isNumeric(raw)) {
      return toNumber(raw);
    }
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    const exp = parseExpression(raw, evalListItem);

    const result = exp.map(e => this.evalExp(e, scopeObject));
    if (result.length === 1) {
      return result[0];
    }
    return result.join('');
  }

  mapValuesDeep(
    obj: any,
    fn: (params: {
      value: any;
      key: string;
      obj: any;
      path: Array<string | number>;
    }) => void,
    path: Array<string | number> = []
  ): any {
    return mapValues(obj, (val, key) => {
      return isArray(val)
        ? val.map((innerVal, idx) => {
            return isPlainObject(innerVal)
              ? this.mapValuesDeep(innerVal, fn, path.concat(key, idx))
              : fn({ value: innerVal, key, obj, path: path.concat(key, idx) });
          })
        : isPlainObject(val)
        ? this.mapValuesDeep(val, fn, path.concat(key))
        : fn({ value: val, key, obj, path: path.concat(key) });
    });
  }

  deepEval(obj: Record<string, unknown>, watcher?: (params: { result: any }) => void) {
    const stops: ReturnType<typeof watch>[] = [];

    const evaluated = this.mapValuesDeep(obj, ({ value: v, path }) => {
      if (typeof v === 'string') {
        const isDynamicExpression = parseExpression(v).some(
          exp => typeof exp !== 'string'
        );
        const result = this.maskedEval(v);
        if (isDynamicExpression && watcher) {
          const stop = watch(
            () => {
              const result = this.maskedEval(v);
              return result;
            },
            newV => {
              set(evaluated, path, newV);
              watcher({ result: evaluated });
            }
          );
          stops.push(stop);
        }

        return result;
      }
      return v;
    });

    return {
      result: evaluated,
      stop: () => stops.forEach(s => s()),
    };
  }
}

// copy and modify from this library
// https://github.com/dy/parenthesis/blob/master/index.js
export function parseExpression(str: string, parseListItem = false): Exp[] {
  if (
    (str.includes(LIST_ITEM_EXP) || str.includes(LIST_ITEM_INDEX_EXP)) &&
    !parseListItem
  ) {
    return [str];
  }

  let res = [str];

  const bracket = ['{{', '}}'];

  const escape = '___';

  // create parenthesis regex
  const pRE = new RegExp(
    ['\\', bracket[0], '[^\\', bracket[0], '\\', bracket[1], ']*\\', bracket[1]].join('')
  );

  let ids: number[] = [];

  function replaceToken(token: string) {
    // save token to res
    const refId = res.push(token.slice(bracket[0].length, -bracket[1].length)) - 1;

    ids.push(refId);

    return escape + refId + escape;
  }

  res.forEach(function (str, i) {
    let prevStr;

    // replace paren tokens till there’s none
    let a = 0;
    while (str != prevStr) {
      prevStr = str;
      str = str.replace(pRE, replaceToken);
      if (a++ > 10e3)
        throw Error('References have circular dependency. Please, check them.');
    }

    res[i] = str;
  });

  // wrap found refs to brackets
  ids = ids.reverse();
  res = res.map(function (str) {
    ids.forEach(function (id) {
      str = str.replace(
        new RegExp('(\\' + escape + id + '\\' + escape + ')', 'g'),
        bracket[0] + '$1' + bracket[1]
      );
    });
    return str;
  });

  const re = new RegExp('\\' + escape + '([0-9]+)' + '\\' + escape);
  // transform references to tree
  function nest(str: string, refs: string[]): Exp[] {
    const res = [];
    let match: RegExpExecArray | null;

    let a = 0;
    while ((match = re.exec(str))) {
      if (a++ > 10e3) throw Error('Circular references in parenthesis');
      const pre = str.slice(0, match.index - 2);
      if (pre) {
        res.push(pre);
      }

      res.push(nest(refs[Number(match[1])], refs));

      str = str.slice(match.index + match[0].length + 2);
    }
    if (str) {
      res.push(str);
    }

    return res;
  }

  return nest(res[0], res);
}
