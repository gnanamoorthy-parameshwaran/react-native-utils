import React from 'react';
import type { EmitEvent } from '../types';

const APIContext = React.createContext<{ emitEvent: EmitEvent }>({
  emitEvent: () => {},
});

export default APIContext;
