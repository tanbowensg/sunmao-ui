import { LIST_ITEM_EXP, LIST_ITEM_INDEX_EXP } from '../constants';

type Exp = string | Exp[];

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

export function evalExp(exp: Exp): string {
  if (typeof exp === 'string') {
    return exp;
  }
  const evalText = exp.map(ex => evalExp(ex)).join('');

  try {
    return new Function(`with(this) { return ${evalText} }`).call({
      $moduleId: 'myModule',
      $listItem: {
        id: 'item1',
      },
      moduleNameitem1: 'hello',
      myModuletext: {
        value: 'world',
      },
      input1: {
        value: '!',
      },
    });
  } catch (e: any) {
    // return undefined;
    return evalText;
  }
}
