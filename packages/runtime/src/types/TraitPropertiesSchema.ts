import { Type } from '@sinclair/typebox';

export const EventHandlerSchema = Type.Object(
  {
    type: Type.String(),
    componentId: Type.String(),
    method: Type.Object({
      name: Type.String(),
      parameters: Type.Record(Type.String(), Type.String()),
    }),
    wait: Type.Optional(
      Type.Object({
        type: Type.KeyOf(
          Type.Object({
            debounce: Type.String(),
            throttle: Type.String(),
            delay: Type.String(),
          })
        ),
        time: Type.Number(),
      })
    ),
    disabled: Type.Optional(Type.Boolean()),
  },
  { $id: 'eventHanlder' }
);

export const FetchTraitPropertiesSchema = Type.Object({
  url: Type.String(), // {format:uri}?;
  method: Type.String(), // {pattern: /^(get|post|put|delete)$/i}
  lazy: Type.Boolean(),
  headers: Type.Record(Type.String(), Type.String()),
  body: Type.Record(Type.String(), Type.String()),
  onComplete: Type.Array(EventHandlerSchema),
});
