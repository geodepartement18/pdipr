
/* ============================================================
   CONFIGURATION
============================================================ */

const CONFIG = {

    /*
     * Votre Web Map
     */
    webMapId:
        "3aa76287606145bc871517dd639a464e",


    /*
     * Votre FeatureLayer
     */
    layerUrl:
        "https://services-eu1.arcgis.com/BskcOcOpYAUZPEMQ/ArcGIS/rest/services/pdipr_cher/FeatureServer/0",


    /*
     * Champ photo.
     *
     * Pour l'instant null car les photos de votre
     * application Experience Builder ne sont pas
     * présentes dans cette couche.
     */
    photoField:
        null,


    /*
     * Correspondance des champs.
     *
     * Le script cherche automatiquement le premier
     * champ existant.
     */
    fields: {

        id: [
            "code_iti",
            "CODE_ITI",
            "id_iti",
            "ID_ITI",
            "OBJECTID"
        ],

        title: [
            "nom_iti",
            "NOM_ITI",
            "nom",
            "NOM"
        ],

        practice: [
            "pratique",
            "PRATIQUE"
        ],

        commune: [
            "nom_com",
            "NOM_COM",
            "commune",
            "COMMUNE"
        ],

        distance: [
            "dist",
            "DIST",
            "distance",
            "DISTANCE"
        ],

        duration: [
            "duree",
            "DUREE",
            "durée"
        ],

        type: [
            "type_iti",
            "TYPE_ITI",
            "type",
            "TYPE"
        ],

        elevationMin: [
            "alti_min",
            "ALTI_MIN"
        ],

        elevationMax: [
            "alti_max",
            "ALTI_MAX"
        ],

        elevationGain: [
            "denivele",
            "DENIVELE"
        ],

        manager: [
            "gestionnaire",
            "GESTIONNAIRE"
        ],

        observations: [
            "obs",
            "OBS",
            "observation",
            "OBSERVATIONS"
        ]

    }

};


/* ============================================================
   ETAT DE L'APPLICATION
============================================================ */

const state = {

    webmap: null,

    view: null,

    layer: null,

    layerView: null,

    search: null,

    locate: null,

    allFeatures: [],

    filteredFeatures: [],

    fieldMap: {},

    activeFilter: "ALL",

    searchText: "",

    selectedObjectId: null,

    highlight: null

};


/* ============================================================
   RACCOURCI DOM
============================================================ */

function $(id) {

    return document.getElementById(id);

}


/* ============================================================
   ECHAPPEMENT HTML
============================================================ */

function escapeHtml(value) {

    return String(value ?? "")

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


/* ============================================================
   NORMALISATION TEXTE
============================================================ */

function normalize(value) {

    return String(value ?? "")

        .normalize("NFD")

        .replace(/[\u0300-\u036f]/g, "")

        .toLowerCase()

        .trim();

}


/* ============================================================
   FORMAT DISTANCE
============================================================ */

function formatDistance(value) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {

        return "—";

    }


    return number.toLocaleString(

        "fr-FR",

        {

            minimumFractionDigits: 2,

            maximumFractionDigits: 2

        }

    );

}


/* ============================================================
   TROUVER UN CHAMP
============================================================ */

function findField(fields, candidates) {

    const fieldsMap =
        new Map(

            fields.map(

                field => [

                    field.name.toLowerCase(),

                    field.name

                ]

            )

        );


    for (const candidate of candidates) {

        const result =
            fieldsMap.get(

                candidate.toLowerCase()

            );


        if (result) {

            return result;

        }

    }


    return null;

}


/* ============================================================
   CONSTRUIRE LA CARTE DES CHAMPS
============================================================ */

function buildFieldMap(fields) {

    for (

        const [logicalName, candidates]

        of Object.entries(CONFIG.fields)

    ) {

        state.fieldMap[logicalName] =
            findField(

                fields,

                candidates

            );

    }


    console.table(state.fieldMap);

}


/* ============================================================
   LIRE UN ATTRIBUT
============================================================ */

function getAttribute(feature, logicalName) {

    const field =
        state.fieldMap[logicalName];


    if (!field) {

        return null;

    }


    return feature.attributes[field];

}


/* ============================================================
   ERREUR
============================================================ */

function showError(error) {

    console.error(error);


    $("errorPanel")
        .classList
        .remove("d-none");


    $("errorMessage")
        .textContent =
            error?.message ||
            String(error);

}


/* ============================================================
   TOAST
============================================================ */

function showToast(message) {

    $("toastMessage")
        .textContent = message;


    const toast =
        bootstrap.Toast
            .getOrCreateInstance(

                $("appToast"),

                {
                    delay: 3000
                }

            );


    toast.show();

}


/* ============================================================
   TEST PRATIQUE
============================================================ */

function matchesPractice(

    value,
    filter

) {

    if (

        !filter ||
        filter === "ALL"

    ) {

        return true;

    }


    const text =
        normalize(value);


    const wanted =
        normalize(filter);


    /*
     * Cas particulier :
     * Cyclo et pédestre
     */

    if (

        wanted ===
        "cyclo et pedestre"

    ) {

        return (

            text.includes("cyclo") &&
            text.includes("pedestre")

        );

    }


    return (

        text === wanted ||
        text.includes(wanted)

    );

}


/* ============================================================
   FILTRER LES DONNEES
============================================================ */

function filterFeatures() {

    const search =
        normalize(state.searchText);


    state.filteredFeatures =

        state.allFeatures.filter(

            feature => {

                const practice =
                    getAttribute(

                        feature,

                        "practice"

                    );


                /*
                 * Filtre pratique
                 */

                if (

                    !matchesPractice(

                        practice,

                        state.activeFilter

                    )

                ) {

                    return false;

                }


                /*
                 * Recherche texte
                 */

                if (!search) {

                    return true;

                }


                const searchable = [

                    getAttribute(
                        feature,
                        "title"
                    ),

                    getAttribute(
                        feature,
                        "commune"
                    ),

                    getAttribute(
                        feature,
                        "id"
                    ),

                    getAttribute(
                        feature,
                        "practice"
                    ),

                    getAttribute(
                        feature,
                        "type"
                    )

                ]

                .map(normalize)

                .join(" ");


                return searchable.includes(search);

            }

        );


    renderCards();

    updateStatistics();

}


/* ============================================================
   FILTRE CARTE
============================================================ */

function applyMapFilter() {

    if (!state.layer) {

        return;

    }


    const field =
        state.fieldMap.practice;


    if (

        !field ||
        state.activeFilter === "ALL"

    ) {

        state.layer.definitionExpression =
            "1=1";

        return;

    }


    const filter =
        state.activeFilter;


    /*
     * Cyclo + pédestre
     */

    if (

        filter ===
        "Cyclo et pédestre"

    ) {

        state.layer.definitionExpression =

            `UPPER(${field}) LIKE '%CYCLO%' ` +

            `AND UPPER(${field}) LIKE '%PÉDESTRE%'`;

        return;

    }


    /*
     * Filtre classique
     */

    const escaped =
        filter.replaceAll(
            "'",
            "''"
        );


    state.layer.definitionExpression =

        `UPPER(${field}) LIKE '%${escaped.toUpperCase()}%'`;

}


/* ============================================================
   STATISTIQUES
============================================================ */

function updateStatistics() {

    const count =
        state.filteredFeatures.length;


    let totalDistance = 0;


    const distanceField =
        state.fieldMap.distance;


    if (distanceField) {

        for (

            const feature
            of state.filteredFeatures

        ) {

            const value =
                Number(

                    feature.attributes[
                        distanceField
                    ]

                );


            if (
                Number.isFinite(value)
            ) {

                totalDistance += value;

            }

        }

    }


    $("countDisplayed")
        .textContent =
            count.toLocaleString(
                "fr-FR"
            );


    $("totalDistance")
        .textContent =
            totalDistance.toLocaleString(

                "fr-FR",

                {

                    minimumFractionDigits: 2,

                    maximumFractionDigits: 2

                }

            );


    $("footerTotal")
        .textContent =
            count.toLocaleString(
                "fr-FR"
            );


    $("footerSelection")
        .textContent =
            state.selectedObjectId
                ? "1"
                : "0";

}


/* ============================================================
   PHOTO
============================================================ */

function getPhoto(feature) {

    /*
     * Si vous possédez un champ contenant
     * une URL d'image, utilisez-le ici.
     */

    if (

        CONFIG.photoField &&
        feature.attributes[
            CONFIG.photoField
        ]

    ) {

        return feature.attributes[
            CONFIG.photoField
        ];

    }


    /*
     * Image temporaire.
     */

    const title =
        encodeURIComponent(

            getAttribute(
                feature,
                "title"
            ) ||
            "Itinéraire"

        );


    return (

        "https://placehold.co/" +

        "800x500/" +

        "5d7046/" +

        "ffffff?text=" +

        title

    );

}


/* ============================================================
   AFFICHER LES CARTES
============================================================ */

function renderCards() {

    const container =
        $("cardsContainer");


    if (

        state.filteredFeatures.length === 0

    ) {

        container.innerHTML = `

            <div class="empty-state">

                <i class="bi bi-search fs-2"></i>

                <div class="mt-2">

                    Aucun itinéraire
                    ne correspond
                    à votre recherche.

                </div>

            </div>

        `;

        return;

    }


    const grid =
        document.createElement("div");


    grid.className =
        "cards-grid";


    for (

        const feature
        of state.filteredFeatures

    ) {

        const objectId =
            feature.attributes.OBJECTID;


        const title =
            getAttribute(
                feature,
                "title"
            ) ||
            "Itinéraire";


        const commune =
            getAttribute(
                feature,
                "commune"
            ) ||
            "";


        const distance =
            getAttribute(
                feature,
                "distance"
            );


        const distanceText =

            Number.isFinite(
                Number(distance)
            )

            ?

            `${formatDistance(distance)} km`

            :

            "";


        const card =
            document.createElement(
                "article"
            );


        card.className =
            "itinerary-card";


        card.dataset.objectid =
            objectId;


        const image =
            getPhoto(feature);


        /*
         * Si distance + titre sont présents,
         * on privilégie le titre.
         */

        card.innerHTML = `

            <div
                class="card-image"
                style="
                    background-image:
                    url('${escapeHtml(image)}')
                "
            >

                ${
                    title
                    ?

                    `
                    <div class="card-title">

                        ${escapeHtml(title)}

                    </div>
                    `

                    :

                    ""
                }


                ${
                    distanceText
                    ?

                    `
                    <div class="distance-label">

                        ${escapeHtml(distanceText)}

                    </div>
                    `

                    :

                    ""
                }


                ${
                    commune
                    ?

                    `
                    <div class="commune-label">

                        ${escapeHtml(commune)}

                    </div>
                    `

                    :

                    ""
                }


                <button
                    class="more-btn"
                    type="button"
                >

                    <i class="bi bi-info-circle"></i>

                    En savoir plus

                </button>

            </div>

        `;


        /*
         * Clic carte
         */

        card.addEventListener(

            "click",

            event => {

                if (

                    event.target.closest(
                        ".more-btn"
                    )

                ) {

                    openDetail(feature);

                    return;

                }


                selectFeature(
                    feature,
                    true
                );

            }

        );


        grid.appendChild(card);

    }


    container.innerHTML = "";

    container.appendChild(grid);


    updateSelectedCard();

}


/* ============================================================
   MARQUER LA CARTE SELECTIONNEE
============================================================ */

function updateSelectedCard() {

    document
        .querySelectorAll(
            ".itinerary-card"
        )
        .forEach(

            card => {

                card.classList.toggle(

                    "selected",

                    String(
                        card.dataset.objectid
                    )

                    ===

                    String(
                        state.selectedObjectId
                    )

                );

            }

        );

}


/* ============================================================
   SELECTION
============================================================ */

async function selectFeature(

    feature,

    zoom = true

) {

    const objectId =
        feature.attributes.OBJECTID;


    state.selectedObjectId =
        objectId;


    updateSelectedCard();

    updateStatistics();


    /*
     * Retirer ancien highlight
     */

    if (state.highlight) {

        state.highlight.remove();

        state.highlight = null;

    }


    /*
     * Nouveau highlight
     */

    if (state.layerView) {

        state.highlight =
            state.layerView.highlight(
                objectId
            );

    }


    /*
     * Zoom
     */

    if (

        zoom &&
        feature.geometry

    ) {

        await state.view.goTo(

            {

                target:
                    feature.geometry,

                zoom:
                    Math.max(
                        state.view.zoom,
                        13
                    )

            },

            {

                duration: 700

            }

        );

    }

}


/* ============================================================
   DETAIL
============================================================ */

function openDetail(feature) {

    const title =
        getAttribute(
            feature,
            "title"
        ) ||
        "Itinéraire";


    $("detailTitle")
        .textContent =
            title;


    const information = [

        [
            "Commune",
            "commune"
        ],

        [
            "Pratique",
            "practice"
        ],

        [
            "Type",
            "type"
        ],

        [
            "Distance",
            "distance"
        ],

        [
            "Durée",
            "duration"
        ],

        [
            "Dénivelé",
            "elevationGain"
        ],

        [
            "Altitude minimale",
            "elevationMin"
        ],

        [
            "Altitude maximale",
            "elevationMax"
        ],

        [
            "Gestionnaire",
            "manager"
        ],

        [
            "Observations",
            "observations"
        ]

    ];


    let html = `

        <img
            class="detail-photo"
            src="${escapeHtml(getPhoto(feature))}"
            alt=""
        >

        <div class="detail-grid">

    `;


    for (

        const [label, field]
        of information

    ) {

        const value =
            getAttribute(
                feature,
                field
            );


        if (

            value === null ||
            value === undefined ||
            value === ""

        ) {

            continue;

        }


        let display =
            value;


        if (

            field ===
            "distance"

        ) {

            display =
                `${formatDistance(value)} km`;

        }


        html += `

            <div class="detail-item">

                <span class="label">

                    ${escapeHtml(label)}

                </span>

                <strong>

                    ${escapeHtml(display)}

                </strong>

            </div>

        `;

    }


    html += `

        </div>

    `;


    $("detailBody")
        .innerHTML =
            html;


    selectFeature(
        feature,
        true
    );


    bootstrap.Modal
        .getOrCreateInstance(
            $("detailModal")
        )
        .show();

}


/* ============================================================
   CHARGEMENT DES DONNEES
============================================================ */

async function loadFeatures() {

    const query =
        state.layer.createQuery();


    query.where =
        "1=1";


    query.outFields =
        ["*"];


    query.returnGeometry =
        true;


    query.orderByFields = [

        state.fieldMap.title ||
        "OBJECTID"

    ];


    const result =
        await state.layer.queryFeatures(
            query
        );


    state.allFeatures =
        result.features;


    filterFeatures();

}


/* ============================================================
   INITIALISATION INTERFACE
============================================================ */

function setupInterface() {


    /*
     * Filtres
     */

    document
        .querySelectorAll(
            ".filter-btn"
        )
        .forEach(

            button => {

                button.addEventListener(

                    "click",

                    () => {

                        document
                            .querySelectorAll(
                                ".filter-btn"
                            )
                            .forEach(

                                b =>
                                    b.classList
                                        .remove(
                                            "active"
                                        )

                            );


                        button.classList
                            .add("active");


                        state.activeFilter =
                            button.dataset.filter;


                        applyMapFilter();

                        filterFeatures();

                    }

                );

            }

        );


    /*
     * Recherche itinéraire
     */

    $("itinerarySearchInput")
        .addEventListener(

            "input",

            event => {

                state.searchText =
                    event.target.value;


                $("clearItinerarySearch")
                    .classList
                    .toggle(

                        "d-none",

                        !state.searchText

                    );


                filterFeatures();

            }

        );


    /*
     * Effacer recherche
     */

    $("clearItinerarySearch")
        .addEventListener(

            "click",

            () => {

                $("itinerarySearchInput")
                    .value = "";


                state.searchText =
                    "";


                $("clearItinerarySearch")
                    .classList
                    .add("d-none");


                filterFeatures();

            }

        );


    /*
     * Haut
     */

    $("scrollTopBtn")
        .addEventListener(

            "click",

            () => {

                $("cardsContainer")
                    .scrollTo(

                        {

                            top: 0,

                            behavior: "smooth"

                        }

                    );

            }

        );


    /*
     * Bas
     */

    $("scrollBottomBtn")
        .addEventListener(

            "click",

            () => {

                $("cardsContainer")
                    .scrollTo(

                        {

                            top:
                                $("cardsContainer")
                                    .scrollHeight,

                            behavior:
                                "smooth"

                        }

                    );

            }

        );


    /*
     * Replier panneau
     */

    $("collapsePanelBtn")
        .addEventListener(

            "click",

            togglePanel

        );


    /*
     * Bouton liste
     */

    $("toggleListBtn")
        .addEventListener(

            "click",

            togglePanel

        );


    /*
     * Outils
     */

    $("layersBtn")
        .addEventListener(

            "click",

            () => openOverlay(
                "Couches"
            )

        );


    $("basemapBtn")
        .addEventListener(

            "click",

            () => openOverlay(
                "Fond de carte"
            )

        );


    $("printBtn")
        .addEventListener(

            "click",

            () => openOverlay(
                "Impression"
            )

        );


    $("locateBtn")
        .addEventListener(

            "click",

            locateUser

        );


    /*
     * Fermer panneau outil
     */

    $("closeOverlayBtn")
        .addEventListener(

            "click",

            closeOverlay

        );


    /*
     * Recherche adresse
     */

    $("addressSearchInput")
        .addEventListener(

            "keydown",

            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    const value =
                        event.target
                            .value
                            .trim();


                    if (value) {

                        searchAddress(
                            value
                        );

                    }

                }

            }

        );


    /*
     * Effacer recherche adresse
     */

    $("clearAddressSearch")
        .addEventListener(

            "click",

            () => {

                $("addressSearchInput")
                    .value = "";


                $("clearAddressSearch")
                    .classList
                    .add("d-none");


                $("searchResults")
                    .classList
                    .add("d-none");

            }

        );

}


/* ============================================================
   REPLIER PANNEAU
============================================================ */

function togglePanel() {

    $("catalogPanel")
        .classList
        .toggle("collapsed");


    const collapsed =
        $("catalogPanel")
            .classList
            .contains("collapsed");


    $("collapsePanelBtn")
        .innerHTML = `

            <i class="bi bi-chevron-${
                collapsed
                    ? "right"
                    : "left"
            }"></i>

        `;


    setTimeout(

        () => {

            if (state.view) {

                state.view.resize();

            }

        },

        300

    );

}


/* ============================================================
   PANNEAU OUTILS
============================================================ */

function openOverlay(title) {

    $("overlayTitle")
        .textContent =
            title;


    const content =
        $("overlayContent");


    content.innerHTML = "";


    /*
     * COUCHES
     */

    if (title === "Couches") {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "overlay-body";


        state.webmap.allLayers
            .forEach(

                layer => {

                    const row =
                        document.createElement(
                            "div"
                        );


                    row.className =
                        "form-check mb-2";


                    row.innerHTML = `

                        <input
                            class="form-check-input"
                            type="checkbox"
                            ${
                                layer.visible
                                    ? "checked"
                                    : ""
                            }
                        >

                        <label
                            class="form-check-label"
                        >

                            ${escapeHtml(
                                layer.title ||
                                "Couche"
                            )}

                        </label>

                    `;


                    row
                        .querySelector(
                            "input"
                        )
                        .addEventListener(

                            "change",

                            event => {

                                layer.visible =
                                    event.target
                                        .checked;

                            }

                        );


                    wrapper
                        .appendChild(
                            row
                        );

                }

            );


        content
            .appendChild(
                wrapper
            );

    }


    /*
     * FOND DE CARTE
     */

    if (title === "Fond de carte") {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "overlay-body";


        wrapper.innerHTML = `

            <label class="form-label">

                Fond de carte

            </label>


            <select
                id="basemapSelect"
                class="form-select"
            >

                <option value="streets-vector">
                    Rues
                </option>

                <option value="topo-vector">
                    Topographique
                </option>

                <option value="satellite">
                    Satellite
                </option>

                <option value="hybrid">
                    Satellite hybride
                </option>

                <option value="gray-vector">
                    Gris clair
                </option>

                <option value="dark-gray-vector">
                    Gris foncé
                </option>

            </select>

        `;


        content
            .appendChild(
                wrapper
            );


        $("basemapSelect")
            .addEventListener(

                "change",

                event => {

                    state.webmap.basemap =
                        event.target.value;

                }

            );

    }


    /*
     * IMPRESSION
     */

    if (title === "Impression") {

        const wrapper =
            document.createElement(
                "div"
            );


        wrapper.className =
            "overlay-body";


        wrapper.innerHTML = `

            <p class="small text-muted">

                Imprime la carte actuellement
                affichée.

            </p>


            <button
                id="browserPrintBtn"
                class="btn btn-primary w-100"
            >

                <i class="bi bi-printer"></i>

                Imprimer

            </button>

        `;


        content
            .appendChild(
                wrapper
            );


        $("browserPrintBtn")
            .addEventListener(

                "click",

                () => {

                    window.print();

                }

            );

    }


    $("mapOverlayPanel")
        .classList
        .remove("d-none");

}


/* ============================================================
   FERMER PANNEAU
============================================================ */

function closeOverlay() {

    $("mapOverlayPanel")
        .classList
        .add("d-none");

}


/* ============================================================
   LOCALISATION
============================================================ */

async function locateUser() {

    try {

        await state.locate.locate();

    }

    catch (error) {

        console.error(error);

        showToast(
            "Impossible de récupérer votre position."
        );

    }

}


/* ============================================================
   RECHERCHE ADRESSE
============================================================ */

async function searchAddress(
    text
) {

    if (!state.search) {

        return;

    }


    $("clearAddressSearch")
        .classList
        .remove("d-none");


    try {

        const response =
            await state.search.search(
                text
            );


        const results =
            response.results
                .flatMap(

                    group =>
                        group.results ||
                        []

                );


        const box =
            $("searchResults");


        if (
            results.length === 0
        ) {

            box.innerHTML = `

                <div class="p-3 text-muted">

                    Aucun résultat.

                </div>

            `;


            box.classList
                .remove("d-none");


            return;

        }


        const limited =
            results.slice(
                0,
                8
            );


        box.innerHTML =
            limited
                .map(

                    (result, index) => `

                        <div
                            class="search-result-item"
                            data-index="${index}"
                        >

                            <strong>

                                ${escapeHtml(
                                    result.name ||
                                    ""
                                )}

                            </strong>

                            <br>

                            <span
                                class="small text-muted"
                            >

                                ${escapeHtml(
                                    result.feature
                                        ?.address ||
                                    ""
                                )}

                            </span>

                        </div>

                    `

                )
                .join("");


        limited.forEach(

            (result, index) => {

                const item =
                    box.querySelector(

                        `[data-index="${index}"]`

                    );


                item.addEventListener(

                    "click",

                    async () => {

                        if (
                            result.extent
                        ) {

                            await state.view
                                .goTo(
                                    result.extent
                                );

                        }

                        else if (
                            result.feature
                                ?.geometry
                        ) {

                            await state.view
                                .goTo(
                                    result.feature
                                        .geometry
                                );

                        }


                        box.classList
                            .add("d-none");

                    }

                );

            }

        );


        box.classList
            .remove("d-none");

    }

    catch (error) {

        console.error(error);

        showToast(
            "La recherche d'adresse a échoué."
        );

    }

}


/* ============================================================
   INITIALISATION ARCGIS
============================================================ */

async function initializeMap() {


    /*
     * Import des modules ArcGIS
     */

    const [

        WebMap,

        MapView,

        FeatureLayer,

        Search,

        Locate

    ] = await $arcgis.import([

        "@arcgis/core/WebMap.js",

        "@arcgis/core/views/MapView.js",

        "@arcgis/core/layers/FeatureLayer.js",

        "@arcgis/core/widgets/Search.js",

        "@arcgis/core/widgets/Locate.js"

    ]);


    /*
     * WEB MAP
     */

    state.webmap =
        new WebMap({

            portalItem: {

                id:
                    CONFIG.webMapId

            }

        });


    /*
     * MAP VIEW
     */

    state.view =
        new MapView({

            container:
                "viewDiv",

            map:
                state.webmap,

            constraints: {

                snapToZoom:
                    false

            }

        });


    /*
     * Attendre le chargement
     */

    await state.webmap.load();


    /*
     * Recherche de la couche dans la Web Map
     */

    const targetUrl =
        CONFIG.layerUrl
            .replace(/\/+$/, "")
            .toLowerCase();


    let itineraryLayer =

        state.webmap.allLayers.find(

            layer => {

                if (!layer.url) {

                    return false;

                }


                return (

                    layer.url
                        .replace(
                            /\/+$/,
                            ""
                        )
                        .toLowerCase()

                    ===

                    targetUrl

                );

            }

        );


    /*
     * Si la couche n'existe pas
     * dans la Web Map, on l'ajoute.
     */

    if (!itineraryLayer) {

        itineraryLayer =
            new FeatureLayer({

                url:
                    CONFIG.layerUrl,

                title:
                    "Itinéraires"

            });


        state.webmap.add(
            itineraryLayer
        );

    }


    state.layer =
        itineraryLayer;


    /*
     * Charger la couche
     */

    await state.layer.load();


    /*
     * Identifier les champs
     */

    buildFieldMap(
        state.layer.fields
    );


    /*
     * LayerView
     */

    state.layerView =
        await state.view.whenLayerView(
            state.layer
        );


    /*
     * Recherche adresse
     */

    state.search =
        new Search({

            view:
                state.view,

            includeDefaultSources:
                true,

            popupEnabled:
                false

        });


    /*
     * Localisation
     */

    state.locate =
        new Locate({

            view:
                state.view

        });


    /*
     * Charger les données
     */

    await loadFeatures();


    /*
     * Clic sur la carte
     */

    state.view.on(

        "click",

        async event => {

            try {

                const response =
                    await state.view.hitTest(
                        event,
                        {
                            include:
                                state.layer
                        }
                    );


                const result =
                    response.results.find(

                        item =>
                            item.graphic &&
                            item.graphic.layer
                                ===
                                state.layer

                    );


                if (
                    !result
                ) {

                    return;

                }


                const objectId =
                    result.graphic
                        .attributes
                        .OBJECTID;


                const feature =
                    state.allFeatures.find(

                        item =>

                            String(
                                item.attributes
                                    .OBJECTID
                            )

                            ===

                            String(
                                objectId
                            )

                    );


                if (feature) {

                    selectFeature(
                        feature,
                        false
                    );


                    openDetail(
                        feature
                    );

                }

            }

            catch (error) {

                console.error(
                    error
                );

            }

        }

    );

}


/* ============================================================
   MAIN
============================================================ */

async function main() {

    try {

        setupInterface();

        await initializeMap();

    }

    catch (error) {

        showError(error);

    }

}


/* ============================================================
   DEMARRAGE
============================================================ */

main();
