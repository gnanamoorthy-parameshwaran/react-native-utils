import type {ResolvedOperation} from '../types/ResolvedOperation.ts';

export default class OperationGrouper {
    /** One group per client file: every operation sharing version/folder/resource. */
    public group(operations: ResolvedOperation[]): ResolvedOperation[][] {
        const groups = new Map<string, ResolvedOperation[]>();

        operations.forEach(operation => {
            const key = `${operation.version}::${operation.folder}::${operation.resource}`;
            const group = groups.get(key) ?? [];
            group.push(operation);
            groups.set(key, group);
        });

        return [...groups.values()];
    }
}
