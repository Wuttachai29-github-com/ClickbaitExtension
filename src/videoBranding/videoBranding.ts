import { getYouTubeTitleNodeSelector } from "@ajayyy/maze-utils/lib/elements";
import { getVideoID, VideoID } from "@ajayyy/maze-utils/lib/video";
import { waitForElement } from "@ajayyy/maze-utils/lib/dom";
import { ThumbnailResult } from "../thumbnails/thumbnailData";
import { replaceThumbnail } from "../thumbnails/thumbnailRenderer";
import { TitleResult } from "../titles/titleData";
import { findOrCreateShowOriginalButton, hideShowOriginalButton, replaceTitle } from "../titles/titleRenderer";

export type BrandingUUID = string & { readonly __brandingUUID: unique symbol };

export interface BrandingResult {
    titles: TitleResult[];
    thumbnails: ThumbnailResult[];
}

export enum BrandingLocation {
    Related,
    Watch
}

export interface VideoBrandingInstance {
    showCustomBranding: boolean;
    updateBranding: () => Promise<void>;
}

const videoBrandingInstances: Record<VideoID, VideoBrandingInstance> = {}

export async function replaceCurrentVideoBranding(): Promise<[boolean, boolean]> {
    const title = await waitForElement(getYouTubeTitleNodeSelector()) as HTMLElement;
    const promises: [Promise<boolean>, Promise<boolean>] = [Promise.resolve(false), Promise.resolve(false)]
    const videoID = getVideoID();

    if (videoID !== null) {
        if (title) {
            const videoBrandingInstance = getAndUpdateVideoBrandingInstances(videoID,
                async () => void await replaceCurrentVideoBranding());
            const showCustomBranding = videoBrandingInstance.showCustomBranding;
    
            promises[0] = replaceTitle(title, videoID, showCustomBranding, BrandingLocation.Watch, true);

            void handleShowOriginalButton(title, videoID, BrandingLocation.Watch, promises);
        }

        //todo: replace thumbnail in background of .ytp-cued-thumbnail-overlay-image
    }

    return Promise.all(promises);
}

export function replaceVideoCardBranding(element: HTMLElement): Promise<[boolean, boolean]> {
    const link = element.querySelector("#thumbnail") as HTMLAnchorElement;

    if (link) {
        // todo: fastest would be to preload via /browser request
        const videoID = link.href?.match(/\?v=(.{11})/)?.[1] as VideoID;

        const videoBrandingInstance = getAndUpdateVideoBrandingInstances(videoID,
            async () => void await replaceVideoCardBranding(element));
        const showCustomBranding = videoBrandingInstance.showCustomBranding;

        const promises = [replaceThumbnail(element, videoID, showCustomBranding),
            replaceTitle(element, videoID, showCustomBranding, BrandingLocation.Related, false)] as [Promise<boolean>, Promise<boolean>];

        void handleShowOriginalButton(element, videoID, BrandingLocation.Related, promises);

        return Promise.all(promises) as Promise<[boolean, boolean]>;
    }

    return new Promise((resolve) => resolve([false, false]));
}

async function handleShowOriginalButton(element: HTMLElement, videoID: VideoID, brandingLocation: BrandingLocation, promises: [Promise<boolean>, Promise<boolean>]): Promise<HTMLElement | null> {
    hideShowOriginalButton(element);

    const result = await Promise.race(promises);
    if (result || (await Promise.all(promises)).some((r) => r)) {
        return await findOrCreateShowOriginalButton(element, brandingLocation, videoID);
    }

    return null;
}

function getAndUpdateVideoBrandingInstances(videoID: VideoID, updateBranding: () => Promise<void>): VideoBrandingInstance {
    if (!videoBrandingInstances[videoID]) {
        videoBrandingInstances[videoID] = {
            showCustomBranding: true,
            updateBranding
        }
    } else {
        videoBrandingInstances[videoID].updateBranding = updateBranding;
    }

    return videoBrandingInstances[videoID];
}

export async function toggleShowCustom(videoID: VideoID): Promise<boolean> {
    if (videoBrandingInstances[videoID]) {
        const newValue = !videoBrandingInstances[videoID].showCustomBranding;
        videoBrandingInstances[videoID].showCustomBranding = newValue;
        await videoBrandingInstances[videoID].updateBranding();

        return newValue;
    }

    // Assume still showing, but something has gone very wrong if it gets here
    return true;
}

export function clearVideoBrandingInstances(): void {
    for (const videoID in videoBrandingInstances) {
        delete videoBrandingInstances[videoID];
    }
}

export function startThumbnailListener(): void {
    // hacky prototype
    const elementsDealtWith = new Set<Element>();
    // let stop = 0;
    setInterval(() => {
        // if (stop > 8) return;
        const newElements = [...document.querySelectorAll("ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer")].filter((element) => !elementsDealtWith.has(element));
        for (const element of newElements) {
            elementsDealtWith.add(element);

            void replaceVideoCardBranding(element as HTMLElement);

            // stop++;
            return;
        }
    }, 10);
}