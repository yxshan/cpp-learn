#include <iostream>
#include <vector>

int main() {
  std::vector<int> values;
  values.push_back(10);
  values.push_back(20);

  std::cout << values[0] << ' ' << values[1] << '\n';
}
