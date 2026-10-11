# Changelog

## [2.0.1](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v2.0.0...v2.0.1) (2026-10-11)


### Bug Fixes

* **generateAPI:** resolve allOf, named enums and other schemas that came out unknown ([49bc20a](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/49bc20a4782b12f6650295e9afce4d190f964dd5))

# [2.0.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.4.0...v2.0.0) (2026-10-11)


* feat(createAPI)!: add cached useQuery and invalidateQueries ([f0c5686](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/f0c5686cf604a94fb409e69ed4eeff2b9ca1bf51))
* refactor(generateAPI)!: emit API clients only ([039e725](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/039e7257f6e2ed9196644be46f50d2a08b552f02))


### Features

* **createAPI:** add useInfiniteQuery for append-as-you-scroll lists ([8061821](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/806182124dafab8bf8c3e19750c17b29197ab75c))
* **createAPI:** drop expired cache entries on every write ([04d0ec9](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/04d0ec91cc7abc8889dc2bee227482631a086bd8))
* **createAPI:** keep the previous page on screen while paginating ([925e11a](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/925e11ace89d4436ec1d20a53eadd5833f69aec6))
* **createAPI:** refetch queries on screen focus via an injected useFocusEffect ([383e341](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/383e341e87f0c80379f30f1a5bdd9e1da613b1ac))
* **createAPI:** revalidate on app foreground and network reconnect ([48c6e2b](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/48c6e2bb8612d9da1e9005b6cf13222dc2b741b7))
* **createAPI:** revalidate stale query data in the background ([aeb10c2](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/aeb10c20fed5ab4907f72449e4cffc5e44d3be02))
* **createAPI:** share unchanged parts of query results between fetches ([99da70c](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/99da70cba673ec608b4c2003b26f03fcdcfb743e))
* **skills:** ship an AI agent skill installable with add-skill ([af69ea3](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/af69ea3cf9da59646e2e42bb390febdabe6e0702))


### BREAKING CHANGES

* createAPI returns an object instead of the useAPI hook.
useAPI no longer accepts cacheConfig or returns invalidateCache /
invalidateCacheGroup; getCacheKey, the `cache` option and the cache drivers
(MemoryCacheDriver, AsyncStorageCacheDriver, TaggedCacheDriver) are removed.
* regenerated clients no longer return invalidate helpers or
cache GET responses.

# [1.4.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.3.0...v1.4.0) (2026-09-02)


### Features

* **generateAPI:** clear the tag group from a paginated GET's own invalidate helper ([56cec5a](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/56cec5a874a065e740325a3c4c7967f3c053b860))

# [1.3.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.2.1...v1.3.0) (2026-09-02)


### Features

* **createAPI:** add exception classes for the full HTTP error status range ([bbd1a26](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/bbd1a269d7d07a07e2a4bb6e0055e1afe63dc0e1))
* **createAPI:** support paginated GET caching and tag-based group invalidation ([8c1c161](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/8c1c161d4b7f2d4bdeec6d6eeac8c5ada96733c3))

## [1.2.1](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.2.0...v1.2.1) (2026-08-30)


### Bug Fixes

* **createAPI:** fixes missing APIContext, Its wrapper exports ([5f71ed6](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/5f71ed62ef85218284d1471fc69e4bee991b9666))

# [1.2.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.1.0...v1.2.0) (2026-08-30)


### Features

* **createAPI:** adds support for global error handler(onError) ([64dad5f](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/64dad5fbccb4b891da06668ae29c7f4e90eb366f))

# [1.1.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.0.8...v1.1.0) (2026-08-04)


### Bug Fixes

* removed ResponseSuccessType type wrapper ([5cc8169](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/5cc8169bcc771e9898baaa5f14b15190ec37a0a4))


### Features

* adds utils ([6b1caed](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/6b1caedcc778415e61777acab01ff4800b97e28d))

## [1.0.8](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v0.2.1...v1.0.8) (2026-07-29)

## [0.2.1](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v0.2.0...v0.2.1) (2026-07-29)

# [0.2.0](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/compare/v1.0.7...v0.2.0) (2026-07-29)


### Features

* adds retry support for createAPI ([8e55003](https://github.com/gnanamoorthy-parameshwaran/react-native-utils/commit/8e55003dbb464a367a83ea130c70a5985a058a88))
