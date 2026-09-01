#include <array>
#include <iostream>
#include <span>

int main() {
    std::array<unsigned short, 3> values{10, 20, 30};
    const std::span view{values};
    const auto bytes = std::as_bytes(view);

    std::cout << "elements=" << view.size() << '\n';
    std::cout << std::boolalpha;
    std::cout << "bytes_match="
              << (bytes.size() == values.size() * sizeof(values[0])) << '\n';
}
