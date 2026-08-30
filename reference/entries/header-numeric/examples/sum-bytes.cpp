#include <array>
#include <iostream>
#include <numeric>

int main() {
    const std::array<int, 4> response_sizes{320, 480, 700, 500};
    const long long total = std::accumulate(response_sizes.begin(),
                                            response_sizes.end(), 0LL);

    std::cout << "bytes=" << total << '\n';
}
