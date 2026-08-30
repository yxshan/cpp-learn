#include <algorithm>
#include <array>
#include <iostream>
#include <string_view>

struct Route {
    std::string_view path;
};

struct CompareRoutePath {
    bool operator()(const Route& route, std::string_view path) const {
        return route.path < path;
    }

    bool operator()(std::string_view path, const Route& route) const {
        return path < route.path;
    }
};

int main() {
    constexpr std::array<Route, 3> routes{{{"/health"}, {"/jobs"}, {"/users"}}};

    const auto print_status = [&](std::string_view route) {
        const bool enabled = std::binary_search(routes.begin(), routes.end(), route,
                                                CompareRoutePath{});
        std::cout << route << '=' << (enabled ? "enabled" : "disabled") << '\n';
    };

    print_status("/health");
    print_status("/admin");
}
