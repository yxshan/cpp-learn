#include <algorithm>
#include <array>
#include <iostream>

int main() {
    const std::array<int, 3> source{10, 20, 30};
    std::array<int, 3> destination{};
    std::copy(source.begin(), source.end(), destination.begin());

    for (std::size_t index = 0; index < destination.size(); ++index) {
        std::cout << destination[index]
                  << (index + 1 == destination.size() ? '\n' : ' ');
    }
}
