import { StateManager } from '../src/services/stateStore';

describe('parseExpression function', () => {
  const parseExpression = new StateManager().parseExpression;
  it('can parse {{}} expression', () => {
    expect(parseExpression('{{ value }}')).toMatchObject([
      { expression: 'value', isDynamic: true },
    ]);
    expect(parseExpression('Hello, {{ value }}!')).toMatchObject([
      { expression: 'Hello, ', isDynamic: false },
      { expression: 'value', isDynamic: true },
      { expression: '!', isDynamic: false },
    ]);
    expect(
      parseExpression('{{ $listItem.name }} is in {{ root.listTitle }} list')
    ).toMatchObject([
      { expression: '{{$listItem.name}}', isDynamic: false },
      { expression: ' is in ', isDynamic: false },
      { expression: 'root.listTitle', isDynamic: true },
      { expression: ' list', isDynamic: false },
    ]);
    expect(parseExpression('{{{{}}}}}}')).toMatchObject([
      { expression: '{{', isDynamic: true },
      { expression: '}}}}', isDynamic: false },
    ]);
  });

  it('can parse $listItem expression', () => {
    expect(parseExpression('{{ $listItem.value }}')).toMatchObject([
      { expression: '{{$listItem.value}}', isDynamic: false },
    ]);
    expect(parseExpression('{{ $listItem.value }}', true)).toMatchObject([
      { expression: '$listItem.value', isDynamic: true },
    ]);
    expect(parseExpression('{{ $listItem.value }}', true)).toMatchObject([
      { expression: '$listItem.value', isDynamic: true },
    ]);
    expect(
      parseExpression(
        '{{ {{$moduleId}}input.value + {{$moduleId}}fetch.value }}someText',
        true
      )
    ).toMatchObject([{ expression: '$listItem.value', isDynamic: true }]);
  });
});
