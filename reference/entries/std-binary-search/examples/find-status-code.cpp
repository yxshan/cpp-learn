#include <algorithm>
#include <array>
#include <iostream>

int main() {
    const std::array<int, 4> supported_codes{200, 201, 204, 503};

    std::cout << std::boolalpha;
    std::cout << "200=" << std::binary_search(supported_codes.begin(),
                                               supported_codes.end(), 200)
              << '\n';
    std::cout << "404=" << std::binary_search(supported_codes.begin(),
                                               supported_codes.end(), 404)
              << '\n';
}
