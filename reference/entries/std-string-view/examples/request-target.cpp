#include <iostream>
#include <optional>
#include <string>
#include <string_view>

struct RequestTarget {
    std::string path;
    std::optional<std::string> query;
};

RequestTarget parse_target(std::string_view target) {
    const std::size_t marker = target.find('?');
    if (marker == std::string_view::npos) {
        return {std::string{target}, std::nullopt};
    }

    return {
        std::string{target.substr(0, marker)},
        std::string{target.substr(marker + 1)},
    };
}

int main() {
    const std::string input{"/search?q=cpp"};
    const RequestTarget parsed = parse_target(input);
    std::cout << parsed.path << '\n';
    std::cout << parsed.query.value_or("<none>") << '\n';
}
