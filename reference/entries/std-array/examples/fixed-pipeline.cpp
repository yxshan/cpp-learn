#include <array>
#include <iostream>
#include <string_view>

int main() {
    constexpr std::array<std::string_view, 3> pipeline{
        "build",
        "test",
        "deploy",
    };

    std::cout << pipeline.size() << ' ' << pipeline[1] << '\n';
}
