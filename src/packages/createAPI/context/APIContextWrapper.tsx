import APIContext from './APIContext';
import type {EmitEvent} from '../types';

export default function APIContextWrapper({emitEvent, children}: {emitEvent: EmitEvent; children: React.ReactNode}) {
    return <APIContext.Provider value={{emitEvent}}>{children}</APIContext.Provider>;
}
