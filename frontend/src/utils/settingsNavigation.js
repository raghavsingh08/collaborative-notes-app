const isValidInAppLocation = (location) => {
    const pathname = location?.pathname

    return typeof pathname === "string" &&
        pathname.startsWith("/") &&
        !pathname.startsWith("//") &&
        pathname !== "/settings"
}

export const createSettingsNavigationOptions = (location) => ({
    state: {
        from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
            state: location.state
        }
    }
})

export const getSettingsReturnLocation = (state) => {
    const from = state?.from

    return isValidInAppLocation(from) ? from : null
}