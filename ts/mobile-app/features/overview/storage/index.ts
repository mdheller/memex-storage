import {
    StorageModule,
    StorageModuleConfig,
    StorageModuleConstructorArgs,
} from '@worldbrain/storex-pattern-modules'
import { URLPartsExtractor, URLNormalizer } from '@worldbrain/memex-url-utils'

import {
    COLLECTION_DEFINITIONS,
    COLLECTION_NAMES,
} from '../../../../pages/constants'
import {
    COLLECTION_NAMES as LISTS_COLLECTION_NAMES,
} from '../../../../lists/constants'
import { Page, Visit } from '../types'

export interface Props extends StorageModuleConstructorArgs {
    normalizeUrl: URLNormalizer
    extractUrlParts: URLPartsExtractor
}

export interface PageOpArgs {
    url: string
}

export class OverviewStorage extends StorageModule {
    static PAGE_COLL = COLLECTION_NAMES.page
    static VISIT_COLL = COLLECTION_NAMES.visit
    static BOOKMARK_COLL = COLLECTION_NAMES.bookmark
    static FAVICON_COLL = COLLECTION_NAMES.favIcon


    private normalizeUrl: URLNormalizer
    private extractUrlParts: URLPartsExtractor

    constructor({ normalizeUrl, extractUrlParts, ...args }: Props) {
        super(args)

        this.normalizeUrl = normalizeUrl
        this.extractUrlParts = extractUrlParts
    }

    getConfig = (): StorageModuleConfig => {
        // TODO: These types differ from corresponding Memex ext type (not supported in react native)
        //  TYPE: 'media' => 'string'
        COLLECTION_DEFINITIONS[
            OverviewStorage.PAGE_COLL
        ].fields.screenshot.type = 'string'
        //  TYPE: 'media' => 'string'
        COLLECTION_DEFINITIONS[
            OverviewStorage.FAVICON_COLL
        ].fields.favIcon.type = 'string'
        //  TYPE: 'timestamp' => 'datetime'
        COLLECTION_DEFINITIONS[OverviewStorage.VISIT_COLL].fields.time.type =
            'datetime'
        //  TYPE: 'timestamp' => 'datetime'
        COLLECTION_DEFINITIONS[OverviewStorage.BOOKMARK_COLL].fields.time.type =
            'datetime'

        return {
            collections: {
                ...COLLECTION_DEFINITIONS,
            },
            operations: {
                createPage: {
                    operation: 'createObject',
                    collection: OverviewStorage.PAGE_COLL,
                },
                deletePage: {
                    operation: 'deleteObject',
                    collection: OverviewStorage.PAGE_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                findPage: {
                    operation: 'findObject',
                    collection: OverviewStorage.PAGE_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                findBookmark: {
                    operation: 'findObject',
                    collection: OverviewStorage.BOOKMARK_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                starPage: {
                    operation: 'createObject',
                    collection: OverviewStorage.BOOKMARK_COLL,
                },
                unstarPage: {
                    operation: 'deleteObject',
                    collection: OverviewStorage.BOOKMARK_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                createVisit: {
                    operation: 'createObject',
                    collection: OverviewStorage.VISIT_COLL,
                },
                findVisitsForPage: {
                    operation: 'findObjects',
                    collection: OverviewStorage.VISIT_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                deleteVisitsForPage: {
                    operation: 'deleteObjects',
                    collection: OverviewStorage.VISIT_COLL,
                    args: {
                        url: '$url:string',
                    },
                },
                deleteListEntriesForPage: {
                    operation: 'deleteObjects',
                    collection: LISTS_COLLECTION_NAMES.listEntry,
                    args: {
                        pageUrl: '$url:string',
                    },
                },
            },
        }
    }

    async findPage({ url }: PageOpArgs): Promise<Page | null> {
        url = this.normalizeUrl(url)
        const page = await this.operation('findPage', { url })
        if (!page) {
            return null
        }
        const isStarred = await this.operation('findBookmark', { url })
        return { ...page, isStarred: !!isStarred }
    }

    async isPageStarred({ url }: PageOpArgs): Promise<boolean> {
        url = this.normalizeUrl(url)
        const bookmark = await this.operation('findBookmark', { url })
        return !!bookmark
    }

    createPage(inputPage: Omit<Page, 'domain' | 'hostname'>) {
        const { domain, hostname } = this.extractUrlParts(inputPage.url)

        const page: Page = {
            ...inputPage,
            url: this.normalizeUrl(inputPage.url),
            domain,
            hostname,
        }

        return this.operation('createPage', page)
    }

    async deletePage({ url }: PageOpArgs): Promise<void> {
        url = this.normalizeUrl(url)
        // TODO: can we do this in a transaction?
        await this.operation('deleteVisitsForPage', { url })
        await this.operation('unstarPage', { url })
        await this.operation('deletePage', { url })
        await this.operation('deleteListEntriesForPage', { url })
    }

    starPage({ url, time = Date.now() }: PageOpArgs & { time?: number }) {
        url = this.normalizeUrl(url)
        return this.operation('starPage', { url, time })
    }

    unstarPage({ url }: PageOpArgs) {
        url = this.normalizeUrl(url)
        return this.operation('unstarPage', { url })
    }

    async setPageStar({ url, isStarred }: PageOpArgs & { isStarred: boolean }) {
        url = this.normalizeUrl(url)
        const bookmark = await this.operation('findBookmark', { url })

        if (bookmark == null && isStarred) {
            return this.operation('starPage', { url, time: Date.now() })
        } else if (bookmark != null && !isStarred) {
            return this.operation('unstarPage', { url })
        } else {
            return
        }
    }

    visitPage({ url, time = Date.now() }: PageOpArgs & { time?: number }) {
        const visit: Visit = {
            url: this.normalizeUrl(url),
            time,
        }

        return this.operation('createVisit', visit)
    }

    findPageVisits({ url }: PageOpArgs): Promise<Visit[]> {
        return this.operation('findVisitsForPage', { url })
    }
}
