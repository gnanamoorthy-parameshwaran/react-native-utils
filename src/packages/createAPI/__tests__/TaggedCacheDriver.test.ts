import MemoryCacheDriver from '../drivers/MemoryCacheDriver';
import TaggedCacheDriver from '../drivers/TaggedCacheDriver';

describe('TaggedCacheDriver', () => {
    it('delegates get/set/delete/deleteAll to the wrapped driver when no tags are given', async () => {
        const inner = new MemoryCacheDriver();
        const cache = new TaggedCacheDriver(inner);

        await cache.set('k', {v: 1}, 1000);
        await expect(cache.get('k')).resolves.toEqual({v: 1});
        await expect(inner.get('k')).resolves.toEqual({v: 1});

        await cache.delete('k');
        await expect(cache.get('k')).resolves.toBeUndefined();
    });

    it('invalidateTag clears every key written under that tag', async () => {
        const cache = new TaggedCacheDriver(new MemoryCacheDriver());

        await cache.set('list:page1', ['a'], 60_000, ['business-units']);
        await cache.set('list:page2', ['b'], 60_000, ['business-units']);
        await cache.set('detail:1', {id: 1}, 60_000, ['business-units']);

        await cache.invalidateTag('business-units');

        await expect(cache.get('list:page1')).resolves.toBeUndefined();
        await expect(cache.get('list:page2')).resolves.toBeUndefined();
        await expect(cache.get('detail:1')).resolves.toBeUndefined();
    });

    it('only clears keys carrying the invalidated tag, leaving other tags and untagged keys intact', async () => {
        const cache = new TaggedCacheDriver(new MemoryCacheDriver());

        await cache.set('units:list', ['unit'], 60_000, ['business-units']);
        await cache.set('customers:list', ['customer'], 60_000, ['customers']);
        await cache.set('plain', 'untagged', 60_000);

        await cache.invalidateTag('business-units');

        await expect(cache.get('units:list')).resolves.toBeUndefined();
        await expect(cache.get('customers:list')).resolves.toEqual(['customer']);
        await expect(cache.get('plain')).resolves.toBe('untagged');
    });

    it('supports a key carrying more than one tag, invalidated independently by either tag', async () => {
        const cache = new TaggedCacheDriver(new MemoryCacheDriver());

        await cache.set('shared', 'v', 60_000, ['a', 'b']);
        await cache.invalidateTag('a');

        await expect(cache.get('shared')).resolves.toBeUndefined();
    });

    it('does not duplicate a key in the tag index across repeated writes', async () => {
        const inner = new MemoryCacheDriver();
        const cache = new TaggedCacheDriver(inner);

        await cache.set('k', 1, 60_000, ['t']);
        await cache.set('k', 2, 60_000, ['t']);

        const deleteSpy = jest.spyOn(inner, 'delete');
        await cache.invalidateTag('t');

        // Just the one member key plus the index entry itself -- not two deletes for 'k'.
        expect(deleteSpy).toHaveBeenCalledTimes(2);
        expect(deleteSpy).toHaveBeenCalledWith('k');
    });

    it('invalidating a tag with no members is a no-op, not an error', async () => {
        const cache = new TaggedCacheDriver(new MemoryCacheDriver());
        await expect(cache.invalidateTag('never-used')).resolves.toBeUndefined();
    });

    it('deleteAll on the wrapped driver clears both entries and tag indexes', async () => {
        const cache = new TaggedCacheDriver(new MemoryCacheDriver());

        await cache.set('k', 1, 60_000, ['t']);
        await cache.deleteAll();

        await expect(cache.get('k')).resolves.toBeUndefined();
        // The index itself was wiped too, so re-invalidating the same tag stays a no-op.
        await expect(cache.invalidateTag('t')).resolves.toBeUndefined();
    });
});
