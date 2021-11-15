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
import { parseExpression, evalExp } from '../utils/parseExpression';
(window as any).parse = parseExpression;
(window as any).evalExp = evalExp;

dayjs.extend(relativeTime);
dayjs.extend(isLeapYear);
dayjs.extend(LocalizedFormat);
dayjs.locale('zh-cn');

type ExpChunk = {
  expression: string;
  isDynamic: boolean;
};

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

  constructor() {
    (window as any).store = this.store;
  }

  parseExpression(str: string, parseListItem = false): ExpChunk[] {
    let l = 0;
    let r = 0;
    let isInBrackets = false;
    const res = [];

    while (r < str.length - 1) {
      if (!isInBrackets && str.substr(r, 2) === '{{') {
        if (l !== r) {
          const substr = str.substring(l, r);
          res.push({
            expression: substr,
            isDynamic: false,
          });
        }
        isInBrackets = true;
        r += 2;
        l = r;
      } else if (isInBrackets && str.substr(r, 2) === '}}') {
        // remove \n from start and end of substr
        const substr = str.substring(l, r).replace(/^\s+|\s+$/g, '');
        const chunk = {
          expression: substr,
          isDynamic: true,
        };
        // $listItem cannot be evaled in stateStore, so don't mark it as dynamic
        // unless explicitly pass parseListItem as true
        if (
          (substr.includes(LIST_ITEM_EXP) || substr.includes(LIST_ITEM_INDEX_EXP)) &&
          !parseListItem
        ) {
          chunk.expression = `{{${substr}}}`;
          chunk.isDynamic = false;
        }
        res.push(chunk);

        isInBrackets = false;
        r += 2;
        l = r;
      } else {
        r++;
      }
    }

    if (r >= l && l < str.length) {
      res.push({
        expression: str.substring(l, r + 1),
        isDynamic: false,
      });
    }
    return res;
  }

  evalExp(exp: Exp, scopeObject = {}): unknown {
    console.log('scopeObject', scopeObject);
    if (typeof exp === 'string') {
      return exp;
    }

    if (exp.length === 1 && typeof exp[0] !== 'string') {
      return this.evalExp(exp[0], scopeObject);
    }
    const evalText = exp.map(ex => this.evalExp(ex, scopeObject)).join('');
    console.log('evalText', evalText);
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
    console.log('raw', raw);
    const exp = parseExpression(raw, evalListItem);
    console.log('exp', exp);

    if (isArray(exp) && exp.length === 1 && typeof exp[0] === 'string') {
      return exp[0];
    }

    const result = this.evalExp(exp, scopeObject);
    console.log('最终结果', result);
    return result;
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
