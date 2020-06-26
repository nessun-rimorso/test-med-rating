'use strict'

// modal show

class Modal {
    constructor(modal) {
        this.modal = modal;
        this.closeBtn = modal.querySelector('.modal__btn-close');
    }

    getModal() {
        return this.modal;
    }

    openModal() {
        this.modal.classList.add('modal--show');
    }

    closeModal() {
        const modal = this.closest('.modal');
        modal.classList.remove('modal--show');
    }

    addEventOnClose() {
        this.closeBtn.addEventListener('click', this.closeModal);
    }
}


// localStorage

class LocalStorageService {

    constructor(localStorageKey) {
        this.localStorageKey = localStorageKey;
    }

    load() {
        const item = localStorage.getItem(this.localStorageKey);
        const result = !!item ? JSON.parse(item) : null;

        return result;
    }

    save(newInfo) {
        const newInfoJSON = JSON.stringify(newInfo, null, 2);
        localStorage.setItem(this.localStorageKey, newInfoJSON);
    }
}


// Service API

class ServiceApi {
    constructor(apiBase, favoriteStore) {
        this.apiBase = apiBase;
        this.favoriteStore = favoriteStore;
    }

    getResource = async (url) => {
        const result = await fetch(`${this.apiBase}${url}`);
        if (!result.ok) {
            throw new Error(`Сервер не отвечает, статус ответа ${result.status}`);
        }
        return await result.json();
    }

    getUsers = async () => {
        const result = await this.getResource('users/');
        return result.filter(this._filterUsers).reduce(this._mappingUsersToObj,{});
    }

    getAlbums = async (userId) => {
        const result = await this.getResource(`albums?userId=${userId}`);
        return result.reduce(this._mappingAlbumsToObj, {});
    }

    getPhotos = async (albumId) => {
        const result = await this.getResource(`photos?albumId=${albumId}`);
        return result.reduce(this._mappingPhotosToObj, {});
    }

    _filterUsers = (item) => {
        return item.name;
    }

    _mappingUsersToObj = (acc, {id, name}) => {
        acc[id] = {
            id,
            name,
        }
        return acc;
    }

    _mappingAlbumsToObj = (acc, {userId, id, title}) => {
        acc[id] = {
            userId,
            id,
            name: title,
        }
        return acc;
    }

    _mappingPhotosToObj = (acc, {albumId, id, title, url, thumbnailUrl}) => {
        const favoritesStoreImages = this.favoriteStore.load();
        const isFavoriteImage = (photoId) => {
            if (!favoritesStoreImages || !Object.keys(favoritesStoreImages).length) return false;
            return !!favoritesStoreImages[photoId];
        };
        acc[id] = {
            albumId,
            id,
            title,
            url,
            thumbnailUrl,
            isFavorite: isFavoriteImage(id),
        }
        return acc;
    }
}


const app = () => {
    const apiBase = 'https://json.medrating.org/';
    const modal = document.getElementById('fullImageModal');
    const fullImageModal = new Modal(modal);
    fullImageModal.addEventOnClose();
    const localStorageFavorites = new LocalStorageService('favorites');
    const serviceApi = new ServiceApi(apiBase, localStorageFavorites);

    const state = {
        users: {},
        albums: {},
        photos: {},
    }

    // fetch requests

    const fetchUsers = async () => {
        try {
            const res = await serviceApi.getUsers();
            state.users = res;
            renderUsers();
        } catch (err) {
            errorFetch(err)
        }
    }

    const fetchAlbums = async (userId) => {
        try {
            const res = await serviceApi.getAlbums(userId);
            state.albums = res;
            renderAlbums(userId);
        } catch (err) {
            errorFetch(err)
        }
    }

    const fetchPhotos = async (albumId) => {
        try {
            const res = await serviceApi.getPhotos(albumId);
            state.photos = res;
            renderPhotos(albumId);
        } catch (err) {
            errorFetch(err)
        }
    }


// render functions

    const renderUsers = () => {
        const users = Object.values(state.users);
        const catalog = document.getElementById('catalog');
        let fragment = '';
        users.forEach((user) => {
            const el = renderItemsTemplate(user, 'user');
            fragment += el;
        })
        const listFragment = `<ul class="content__list">${fragment}</ul>`

        catalog.insertAdjacentHTML('afterbegin', listFragment);

        const list = catalog.querySelector('.content__list');
        addEventOnItems(list, listDisclosure);
    };

    const renderAlbums = (userId) => {
        const albums = Object.values(state.albums);
        if (albums.length === 0) return;
        const li = document.querySelector(`[data-user='${userId}']`);
        let fragment = '';
        albums.forEach((album) => {
            const el = renderItemsTemplate(album, 'album');
            fragment += el;
        })
        const listFragment = `<ul class="content__list">${fragment}</ul>`;
        li.insertAdjacentHTML('beforeend', listFragment);
    }

    const renderPhotos = (albumId) => {
        const photos = Object.values(state.photos);
        if (photos.length === 0) return;
        const li = document.querySelector(`[data-album='${albumId}']`);
        let fragment = '';
        photos.forEach((photo) => {
            const el = renderPhotoTemplate(photo);
            fragment += el;
        })
        const listFragment = `<ul class="content__list">${fragment}</ul>`;
        li.insertAdjacentHTML('beforeend', listFragment);

        const list = li.querySelector('.content__list');
        addEventOnItems(list, openFullImage);
        addEventOnItems(list, toggleFavorite);
    }

    const renderItemsTemplate = ({id, name}, templateName) => {
        return `
            <li class="content__item" data-${templateName}="${id}">
                <button class="content__button" type="button">${name}</button>
            </li>
        `;
    }

    const renderPhotoTemplate = ({id, title, url, thumbnailUrl, isFavorite}) => {
        const isActive = () => isFavorite ? 'active' : '';
        return  `
            <li class="content__item" data-photo="${id}">
                <div class="content__image image">
                    <div class="image__wrapper">
                        <button 
                            class="image__btn-star ${isActive()}" 
                            data-image-id="${id}" 
                            type="button">&#9734;
                        </button>
                        <a href="#" title="${title}">
                            <img class="image__pic"
                                 src="${thumbnailUrl}"
                                 data-full-image="${url}"
                                 alt="Фото пользователя">
                        </a>
                    </div>
               </div>
            </li>
        `;
    };


// navigation links
    const tabs = () => {
        const handle = (e) => {
            e.preventDefault();

            const {target} = e;
            if (target.classList.contains('active')) {
                return;
            }

            const nav = target.closest('.navigation');
            const current = nav.querySelector('a.active');
            if (current) {
                current.classList.remove('active');
                const currentTabContent = document.querySelector(current.hash);
                currentTabContent.classList.remove('active');
            }

            target.classList.add('active');

            const nextTabContent = document.querySelector(target.hash);
            nextTabContent.classList.add('active');
        };

        const links = document.querySelectorAll('a[data-toggle]');
        links.forEach((element) => {
            element.addEventListener('click', handle);
        });
    };


// list disclosure

    const listDisclosure = (event) => {
        event.preventDefault();
        const {target} = event;
        if (target.classList.contains('content__button')) {
            event.stopPropagation();
            const item = target.closest('.content__item');
            item.classList.toggle('active');
            if (item.classList.contains('active')) {
                const fetchMethod = Object.keys(item.dataset)[0];
                if (getItemMethod(fetchMethod)) {
                    const itemFunc = getItemMethod(fetchMethod);
                    itemFunc(item.dataset[fetchMethod]);
                }
            } else {
                item.removeChild(item.lastElementChild);
            }
        }
    };

    const getItemMethod = (dataset) => {
        switch (true) {
            case dataset === 'user':
                return fetchAlbums;
            case dataset === 'album':
                return fetchPhotos;
            default:
                return null;
        }
    }

    const addEventOnItems = (list, handle) => {
        list.addEventListener('click', handle)
    }

// Open image

    const openFullImage = (event) => {
        event.preventDefault();
        const { target } = event;
        if (target.classList.contains('image__pic')) {
            const modal = fullImageModal.getModal();
            const fullImageUrl = target.dataset['fullImage'];
            modal.querySelector('img').setAttribute('src', fullImageUrl);
            fullImageModal.openModal();
        }
    }


// choose favorite

    const toggleFavorite = (event) => {
        event.preventDefault();
        const { target } = event;
        if (target.classList.contains('image__btn-star')) {
            const imageId = target.dataset['imageId'];
            target.classList.toggle('active');
            const image = state.photos[imageId];
            image.isFavorite = !image.isFavorite;
            storeFavoriteImages(image);
        }
    }

    const storeFavoriteImages = (photo) => {
        const {id, isFavorite} = photo;
        const createImgObj = (item) => {
            return {
                id: item.id,
                albumId: item.albumId,
                title: item.title,
                url: item.url,
                thumbnailUrl: item.thumbnailUrl,
                isFavorite: item.isFavorite,
            }
        }
        let newFavoritesImages = {};
        const favoritesImages = localStorageFavorites.load() ?
            localStorageFavorites.load() : newFavoritesImages;
        if (isFavorite) {
            const favoriteImg = {};
            favoriteImg[id] = createImgObj(photo);
            newFavoritesImages = { ...favoritesImages, ...favoriteImg };
        } else {
            newFavoritesImages = Object.values(favoritesImages)
                .filter((item) => +item.id !== +id)
                .reduce((acc, item) => {
                    acc[item.id] = createImgObj(item);
                    return acc;
                }, {});
        }
        localStorageFavorites.save(newFavoritesImages);
    }

    const errorFetch = (err) => {
        throw new Error('Что-то не так')
    };


// favorites

    const addEventOnLinkFavorites = () => {
        const linkFavorites = document.getElementById('favourites-tab');
        linkFavorites.addEventListener('click', renderFavorites);
    }

    const renderFavorites = (event) => {
        const { target } = event;
        const containerFavorites = document.querySelector(target.hash);
        const arrayFavorites = localStorageFavorites.load() ? Object.values(localStorageFavorites.load()) : null;

        if (containerFavorites.children.length) {
            containerFavorites.innerHTML = '';
        }

        if (!arrayFavorites.length || !arrayFavorites) return containerFavorites.append(nullFavorites());
        let fragment = '';
        arrayFavorites.forEach((favoriteImage) => {
            const el = renderPhotoTemplate(favoriteImage);
            fragment += el;
        });
        const listImages = `<ul class="content__list">${fragment}</ul>`;
        containerFavorites.insertAdjacentHTML('afterbegin', listImages);
        const list = containerFavorites.querySelector('.content__list');
        addEventOnItems(list, openFullImage);
        addEventOnItems(list, removeFavorite);
    };

    const removeFavorite = (event) => {
        const { target } = event;
        if (target.classList.contains('image__btn-star')) {
            const imageId = target.dataset['imageId'];
            const favoriteItem = localStorageFavorites.load()[imageId];
            favoriteItem.isFavorite = !favoriteItem.isFavorite;
            storeFavoriteImages(favoriteItem);
            removeFavoriteItem(imageId);
        }
    };

    const removeFavoriteItem = (imageId) => {
        const favoriteContainer = document.getElementById('favourites');
        const photoItem = favoriteContainer.querySelector(`[data-photo="${imageId}"]`);
        photoItem.remove();
    }

    const nullFavorites = () => {
        const fragment = document.createElement('h1');
        fragment.innerText = 'В избранное ничего не добавлено!';
        return fragment;
    }


// catalog

    const addEventOnLinkCatalog = () => {
        const linkCatalog = document.getElementById('catalog-tab');
        linkCatalog.addEventListener('click', renderCatalog);
    };

    const renderCatalog = (event) => {
        const { target } = event;
        const containerCatalog = document.querySelector(target.hash);
        if (containerCatalog.children.length) {
            containerCatalog.innerHTML = '';
        }
        fetchUsers();
    };


// вызов функций

    tabs();
    addEventOnLinkFavorites();
    addEventOnLinkCatalog();
};

app();







