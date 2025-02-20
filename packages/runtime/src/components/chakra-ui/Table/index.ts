import { createComponent } from '@sunmao-ui/core';
import { Type } from '@sinclair/typebox';
import { TableImpl } from './Table';
import {
  ColumnsPropertySchema,
  DataPropertySchema,
  MajorKeyPropertySchema,
  RowsPerPagePropertySchema,
  TableStateSchema,
  TableSizePropertySchema,
  IsMultiSelectPropertySchema,
} from './TableTypes';

const PropsSchema = Type.Object({
  data: DataPropertySchema,
  majorKey: MajorKeyPropertySchema,
  rowsPerPage: RowsPerPagePropertySchema,
  size: TableSizePropertySchema,
  columns: ColumnsPropertySchema,
  isMultiSelect: IsMultiSelectPropertySchema,
});

const exampleProperties = {
  data: [
    {
      id: '1',
      name: 'Bowen Tan',
    },
  ],
  columns: [
    {
      key: 'name',
      title: 'Name',
      type: 'text',
    },
  ],
  majorKey: 'id',
  rowsPerPage: 5,
  isMultiSelect: false,
};

export default {
  ...createComponent({
    version: 'chakra_ui/v1',
    metadata: {
      name: 'table',
      displayName: 'Table',
      description: 'chakra-ui table',
      isDraggable: true,
      isResizable: true,
      exampleProperties,
      exampleSize: [8, 6],
    },
    spec: {
      properties: PropsSchema,
      state: TableStateSchema,
      methods: [],
      slots: [],
      styleSlots: [],
      events: [],
    },
  }),
  impl: TableImpl,
};
