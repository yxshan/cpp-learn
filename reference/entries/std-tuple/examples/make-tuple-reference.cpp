#include <functional>
#include <iostream>
#include <string>
#include <tuple>

int main() {
    int counter = 4;
    auto result = std::make_tuple(std::ref(counter), std::string{"ready"});
    std::get<0>(result) += 1;

    std::cout << "counter=" << counter
              << " status=" << std::get<1>(result) << '\n';
}
