#include <functional>
#include <iostream>

int main() {
    std::function<int(int, int)> operation =
        [](int left, int right) { return left + right; };
    std::cout << "add=" << operation(2, 3) << '\n';

    operation = [](int left, int right) { return left * right; };
    std::cout << "multiply=" << operation(2, 3) << '\n';
}
